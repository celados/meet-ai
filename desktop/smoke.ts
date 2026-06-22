import { spawn, type ChildProcess } from 'node:child_process'
import { rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

class CdpClient {
  private id = 0
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>()

  private constructor(private readonly socket: WebSocket) {
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: unknown }
      if (!message.id) return

      const pending = this.pending.get(message.id)
      if (!pending) return

      this.pending.delete(message.id)
      if (message.error) pending.reject(message.error)
      else pending.resolve(message.result)
    }
    socket.onerror = (event) => {
      this.rejectAll(event)
    }
    socket.onclose = () => {
      this.rejectAll(new Error('CDP socket closed'))
    }
  }

  static connect(url: string): Promise<CdpClient> {
    return new Promise((resolvePromise, reject) => {
      const socket = new WebSocket(url)
      socket.onopen = () => resolvePromise(new CdpClient(socket))
      socket.onerror = reject
    })
  }

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.id
    this.socket.send(JSON.stringify({ id, method, params }))

    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP command timed out: ${method}`))
      }, 30_000)

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          resolvePromise(value)
        },
        reject: (reason) => {
          clearTimeout(timer)
          reject(reason)
        },
      })
    })
  }

  close(): void {
    this.socket.close()
  }

  private rejectAll(reason: unknown): void {
    for (const pending of this.pending.values()) pending.reject(reason)
    this.pending.clear()
  }
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appBinary = process.env.MEET_DESKTOP_APP_PATH
  ? resolve(process.env.MEET_DESKTOP_APP_PATH)
  : await resolveDefaultAppBinary()
const appSupport = join(ROOT, '.tmp', 'electron-smoke-app-support')
const home = join(ROOT, '.tmp', 'electron-smoke-home')
const remoteDebuggingPort = Number(process.env.MEET_DESKTOP_SMOKE_PORT ?? 49334)
const appUrl = process.env.MEET_DESKTOP_URL ?? 'https://meet.celados.com'
const appOrigin = new URL(appUrl).origin

await assertFile(appBinary)
await rm(appSupport, { recursive: true, force: true })
await rm(home, { recursive: true, force: true })

let appProcess: ChildProcess | undefined
let cdp: CdpClient | undefined

try {
  appProcess = spawn(appBinary, [`--remote-debugging-port=${remoteDebuggingPort}`, `--user-data-dir=${appSupport}`], {
    env: {
      ...process.env,
      HOME: home,
      MEET_DESKTOP_URL: appUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  appProcess.stdout?.on('data', (chunk) => process.stdout.write(chunk))
  appProcess.stderr?.on('data', (chunk) => process.stderr.write(chunk))

  const pageWsUrl = await waitForPageWebSocket(remoteDebuggingPort, appOrigin, 30_000)
  cdp = await CdpClient.connect(pageWsUrl)
  await cdp.send('Runtime.enable')

  const runtime = await waitForRuntimeState(cdp, appOrigin, 30_000)

  assert(runtime.origin === appOrigin, `unexpected page origin: ${runtime.href ?? 'missing'}`)
  assert(runtime.hasRequire === false, 'renderer has require')
  assert(runtime.hasProcess === false, 'renderer has process')
  assert(runtime.hasMediaDevices === true, 'navigator.mediaDevices is missing')
  assert(runtime.hasGetUserMedia === true, 'getUserMedia is missing')
  assert(runtime.hasGetDisplayMedia === true, 'getDisplayMedia is missing')
  assert(runtime.hasDesktopBridge === true, 'desktop permission bridge is missing')
  assert(Array.isArray(runtime.desktopPermissionKinds), 'desktop permission kinds are missing')
  assert(runtime.desktopPermissionKinds.join(',') === 'microphone,camera,screen', 'unexpected desktop permission kinds')

  await cdp.send('Browser.close').catch(() => undefined)
  console.log(`electron smoke ok: ${runtime.href}`)
} finally {
  cdp?.close()
  if (appProcess && !appProcess.killed) {
    appProcess.kill('SIGTERM')
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000))
    if (!appProcess.killed) appProcess.kill('SIGKILL')
  }
}

async function waitForPageWebSocket(port: number, expectedOrigin: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs
  let lastError = ''

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`)
      const pages = await response.json() as Array<{ type: string; url: string; webSocketDebuggerUrl: string }>
      const page = pages.find((candidate) => candidate.type === 'page' && candidate.url.startsWith(expectedOrigin))
      if (page) return page.webSocketDebuggerUrl
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }

  throw new Error(`Timed out waiting for Electron CDP page: ${lastError}`)
}

async function waitForRuntimeState(cdp: CdpClient, expectedOrigin: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  let lastRuntime: unknown
  let lastError = ''

  while (Date.now() < deadline) {
    try {
      const runtime = await evaluate(cdp, `(async () => ({
        href: location.href,
        origin: location.origin,
        title: document.title,
        readyState: document.readyState,
        hasRequire: typeof require !== 'undefined',
        hasProcess: typeof process !== 'undefined',
        hasMediaDevices: Boolean(navigator.mediaDevices),
        hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
        hasGetDisplayMedia: typeof navigator.mediaDevices?.getDisplayMedia === 'function',
        hasDesktopBridge: typeof window.meetDesktop?.getPermissions === 'function',
        desktopPermissionKinds: window.meetDesktop
          ? Object.keys((await window.meetDesktop.getPermissions())?.permissions ?? {})
          : []
      }))()`) as {
        href?: string
        origin?: string
        hasRequire?: boolean
        hasProcess?: boolean
        hasMediaDevices?: boolean
        hasGetUserMedia?: boolean
        hasGetDisplayMedia?: boolean
        hasDesktopBridge?: boolean
        desktopPermissionKinds?: string[]
      }

      lastRuntime = runtime
      if (runtime.origin === expectedOrigin) return runtime
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }

  throw new Error(`Timed out waiting for app origin ${expectedOrigin}. Last runtime=${JSON.stringify(lastRuntime)} lastError=${lastError}`)
}

async function evaluate(cdp: CdpClient, expression: string): Promise<unknown> {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 30_000,
  }) as { result?: { value?: unknown }; exceptionDetails?: unknown }

  if (result.exceptionDetails) {
    throw new Error(`CDP evaluation failed: ${JSON.stringify(result.exceptionDetails)}`)
  }

  return result.result?.value
}

async function assertFile(path: string): Promise<void> {
  const info = await stat(path)
  if (!info.isFile()) throw new Error(`${path} is not a file`)
}

async function resolveDefaultAppBinary(): Promise<string> {
  const arch = process.arch === 'x64' ? 'x64' : process.arch
  const candidates = [
    join(ROOT, 'release', 'desktop', `mac-${arch}`, 'Meet AI.app', 'Contents', 'MacOS', 'Meet AI'),
    join(ROOT, 'release', 'desktop', 'mac', 'Meet AI.app', 'Contents', 'MacOS', 'Meet AI'),
    join(ROOT, 'release', 'desktop', 'mac-arm64', 'Meet AI.app', 'Contents', 'MacOS', 'Meet AI'),
    join(ROOT, 'release', 'desktop', 'mac-x64', 'Meet AI.app', 'Contents', 'MacOS', 'Meet AI'),
  ]

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate)
      if (info.isFile()) return candidate
    } catch {
      // Try the next common electron-builder macOS output directory.
    }
  }

  throw new Error(`Packaged desktop app binary not found. Checked: ${candidates.join(', ')}`)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
