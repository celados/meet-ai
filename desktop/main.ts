import { app, BrowserWindow, Menu, desktopCapturer, dialog, ipcMain, shell, session, systemPreferences } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { URL } from 'node:url'

const DEFAULT_APP_URL = 'https://meet.celados.com'
const SESSION_PARTITION = 'persist:meet-ai'
const TRUSTED_DOWNLOAD_HOST_SUFFIX = '.r2.cloudflarestorage.com'
const ALLOWED_PERMISSION_TYPES = new Set([
  'media',
  'display-capture',
  'fullscreen',
  'speaker-selection',
  'clipboard-sanitized-write',
])
const DESKTOP_PERMISSION_KINDS = ['microphone', 'camera', 'screen'] as const
const SYSTEM_SETTINGS_URLS: Record<NodeJS.Platform | 'default', Partial<Record<DesktopPermissionKind, string>>> = {
  darwin: {
    microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    camera: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
    screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  },
  win32: {
    microphone: 'ms-settings:privacy-microphone',
    camera: 'ms-settings:privacy-webcam',
  },
  aix: {},
  android: {},
  cygwin: {},
  freebsd: {},
  haiku: {},
  linux: {},
  netbsd: {},
  openbsd: {},
  sunos: {},
  default: {},
}

type DesktopPermissionKind = typeof DESKTOP_PERMISSION_KINDS[number]
type DesktopPermissionState = 'ungranted' | 'inProgress' | 'granted'
type DesktopPermissionRawStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'

type DesktopPermissionSnapshot = {
  isDesktop: true
  platform: NodeJS.Platform
  permissions: Record<DesktopPermissionKind, {
    state: DesktopPermissionState
    status: DesktopPermissionRawStatus
    canRequest: boolean
    canOpenSettings: boolean
    requiresRestart: boolean
  }>
}

let mainWindow: BrowserWindow | null = null
const permissionTrackingUntil = new Map<DesktopPermissionKind, number>()

const appUrl = getConfiguredAppUrl()
const appOrigin = appUrl.origin

app.setName('Meet AI')

app.whenReady().then(async () => {
  writeStartupLog('electron ready')
  configureDesktopPermissionIpc()
  writeStartupLog('desktop permission IPC configured')
  const meetSession = session.fromPartition(SESSION_PARTITION)
  configureSessionPermissions(meetSession)
  writeStartupLog('permissions configured')
  configureApplicationMenu()
  writeStartupLog('menu configured')
  createMainWindow()
  writeStartupLog('window created')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}).catch((error: unknown) => {
  writeStartupLog('startup failed', error)
  console.error('[Meet AI] startup failed', error)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'Meet AI',
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: '#f5f3ee',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      partition: SESSION_PARTITION,
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    writeStartupLog('window ready-to-show')
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedNavigationUrl(url)) {
      return { action: 'allow' }
    }

    if (isTrustedDownloadUrl(url)) {
      void shell.openExternal(url)
    }

    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (isTrustedNavigationUrl(navigationUrl)) return

    event.preventDefault()
    if (isTrustedDownloadUrl(navigationUrl)) {
      void shell.openExternal(navigationUrl)
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (!mainWindow || errorCode === -3) return

    writeStartupLog(`load failed code=${errorCode} description=${errorDescription}`)
    void dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Meet AI',
      message: 'Unable to load Meet AI.',
      detail: errorDescription,
    })
  })

  void mainWindow.loadURL(appUrl.toString())
  writeStartupLog(`loading ${appUrl.origin}`)
}

function configureSessionPermissions(meetSession: Electron.Session) {
  meetSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (!ALLOWED_PERMISSION_TYPES.has(permission)) {
      callback(false)
      return
    }

    callback(isTrustedPermissionRequest(webContents, details))
  })

  meetSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (!ALLOWED_PERMISSION_TYPES.has(permission)) return false

    return isTrustedOrigin(requestingOrigin) ||
      isTrustedOrigin((details as { securityOrigin?: string }).securityOrigin) ||
      isTrustedOrigin((details as { requestingUrl?: string }).requestingUrl) ||
      isTrustedOrigin(webContents?.getURL())
  })

  meetSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      if (!isTrustedOrigin(request.securityOrigin)) {
        callback({})
        return
      }

      const stream = await chooseDisplayMediaStream(request.audioRequested).catch(() => null)
      callback(stream ?? {})
    },
    { useSystemPicker: true },
  )
}

async function chooseDisplayMediaStream(audioRequested: boolean) {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 0, height: 0 },
  })

  if (!sources.length) return {}

  const maxSources = 12
  const choices = sources.slice(0, maxSources)
  const cancelIndex = choices.length
  const dialogOptions = {
    type: 'question',
    title: 'Share screen',
    message: 'Choose what to share in Meet AI.',
    buttons: [...choices.map((source) => source.name || source.id), 'Cancel'],
    cancelId: cancelIndex,
    defaultId: 0,
    noLink: true,
  } satisfies Electron.MessageBoxOptions

  const result = mainWindow
    ? await dialog.showMessageBox(mainWindow, dialogOptions)
    : await dialog.showMessageBox(dialogOptions)

  if (result.response === cancelIndex) return {}

  const selected = choices[result.response]
  if (!selected) return {}

  return {
    video: selected,
    ...(audioRequested && process.platform === 'win32' ? { audio: 'loopback' as const } : {}),
  }
}

function configureApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Meet AI',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Permissions',
          submenu: [
            {
              label: 'Open Microphone Settings',
              click: () => {
                void openDesktopPermissionSettings('microphone')
              },
            },
            {
              label: 'Open Camera Settings',
              click: () => {
                void openDesktopPermissionSettings('camera')
              },
            },
            {
              label: 'Open Screen Recording Settings',
              click: () => {
                void openDesktopPermissionSettings('screen')
              },
            },
          ],
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function getPreloadPath() {
  const mainScriptPath = process.argv.find((arg) => arg.endsWith('main.cjs'))
  if (mainScriptPath) {
    return join(dirname(resolve(mainScriptPath)), 'preload.cjs')
  }

  return join(app.getAppPath(), 'preload.cjs')
}

function configureDesktopPermissionIpc() {
  ipcMain.handle('meet-ai:permissions:get', (event) => {
    if (!isTrustedIpcEvent(event)) return null
    return getDesktopPermissionSnapshot()
  })

  ipcMain.handle('meet-ai:permissions:request', async (event, kind) => {
    if (!isTrustedIpcEvent(event) || !isDesktopPermissionKind(kind)) return null

    await requestDesktopPermission(kind)
    return getDesktopPermissionSnapshot()
  })

  ipcMain.handle('meet-ai:permissions:open-settings', async (event, kind) => {
    if (!isTrustedIpcEvent(event) || !isDesktopPermissionKind(kind)) return null

    await openDesktopPermissionSettings(kind)
    return getDesktopPermissionSnapshot()
  })
}

function getDesktopPermissionSnapshot(): DesktopPermissionSnapshot {
  return {
    isDesktop: true,
    platform: process.platform,
    permissions: {
      microphone: getDesktopPermission('microphone'),
      camera: getDesktopPermission('camera'),
      screen: getDesktopPermission('screen'),
    },
  }
}

function getDesktopPermission(kind: DesktopPermissionKind): DesktopPermissionSnapshot['permissions'][DesktopPermissionKind] {
  const status = getMediaAccessStatus(kind)
  const granted = status === 'granted'

  if (granted) {
    permissionTrackingUntil.delete(kind)
  }

  return {
    state: granted ? 'granted' : isPermissionTrackingActive(kind) ? 'inProgress' : 'ungranted',
    status,
    canRequest: canRequestPermission(kind, status),
    canOpenSettings: Boolean(settingsUrlFor(kind)),
    requiresRestart: process.platform === 'darwin' && (kind === 'microphone' || kind === 'camera') && status === 'denied',
  }
}

async function requestDesktopPermission(kind: DesktopPermissionKind) {
  markPermissionInProgress(kind)

  if (process.platform === 'darwin') {
    if (kind === 'microphone' || kind === 'camera') {
      const granted = await systemPreferences.askForMediaAccess(kind)
      if (!granted) {
        await openDesktopPermissionSettings(kind)
      }
      return
    }

    await requestScreenRecordingPermission()
    if (getMediaAccessStatus(kind) !== 'granted') {
      await openDesktopPermissionSettings(kind)
    }
    return
  }

  await openDesktopPermissionSettings(kind)
}

async function requestScreenRecordingPermission() {
  await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1, height: 1 },
  }).catch((error: unknown) => {
    writeStartupLog('screen recording permission probe failed', error)
  })
}

async function openDesktopPermissionSettings(kind: DesktopPermissionKind) {
  const url = settingsUrlFor(kind)
  if (!url) return

  markPermissionInProgress(kind)
  await shell.openExternal(url)
}

function getMediaAccessStatus(kind: DesktopPermissionKind): DesktopPermissionRawStatus {
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    return 'granted'
  }

  try {
    return systemPreferences.getMediaAccessStatus(kind)
  } catch {
    return 'unknown'
  }
}

function canRequestPermission(kind: DesktopPermissionKind, status: DesktopPermissionRawStatus) {
  if (process.platform === 'darwin') {
    if (kind === 'screen') return status !== 'granted'
    return status === 'not-determined'
  }

  return false
}

function markPermissionInProgress(kind: DesktopPermissionKind) {
  permissionTrackingUntil.set(kind, Date.now() + 120_000)
}

function isPermissionTrackingActive(kind: DesktopPermissionKind) {
  const until = permissionTrackingUntil.get(kind)
  if (!until) return false
  if (Date.now() <= until) return true

  permissionTrackingUntil.delete(kind)
  return false
}

function settingsUrlFor(kind: DesktopPermissionKind) {
  return SYSTEM_SETTINGS_URLS[process.platform][kind] ?? SYSTEM_SETTINGS_URLS.default[kind]
}

function isDesktopPermissionKind(value: unknown): value is DesktopPermissionKind {
  return typeof value === 'string' && DESKTOP_PERMISSION_KINDS.includes(value as DesktopPermissionKind)
}

function isTrustedIpcEvent(event: Electron.IpcMainInvokeEvent) {
  return isTrustedOrigin(event.senderFrame?.url) || isTrustedOrigin(event.sender.getURL())
}

function isTrustedPermissionRequest(
  webContents: Electron.WebContents,
  details: Electron.PermissionRequest,
) {
  const requestDetails = details as {
    requestingUrl?: string
    securityOrigin?: string
  }

  return isTrustedOrigin(requestDetails.requestingUrl) ||
    isTrustedOrigin(requestDetails.securityOrigin) ||
    isTrustedOrigin(webContents.getURL())
}

function isTrustedNavigationUrl(value: string) {
  return isTrustedOrigin(value)
}

function isTrustedDownloadUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith(TRUSTED_DOWNLOAD_HOST_SUFFIX)
  } catch {
    return false
  }
}

function isTrustedOrigin(value?: string | null) {
  if (!value) return false

  try {
    return new URL(value).origin === appOrigin
  } catch {
    return false
  }
}

function getConfiguredAppUrl() {
  const rawUrl = process.env.MEET_DESKTOP_URL ?? DEFAULT_APP_URL
  const parsed = new URL(rawUrl)

  if (parsed.protocol === 'https:') return parsed
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]') {
    return parsed
  }

  throw new Error(`MEET_DESKTOP_URL must be https or localhost. Received: ${rawUrl}`)
}

function writeStartupLog(message: string, error?: unknown) {
  try {
    const logsDir = join(app.getPath('userData'), 'logs')
    mkdirSync(logsDir, { recursive: true })
    const detail = error instanceof Error ? `\n${error.stack ?? error.message}` : error ? `\n${String(error)}` : ''
    appendFileSync(join(logsDir, 'desktop-main.log'), `[${new Date().toISOString()}] ${message}${detail}\n`)
  } catch {
    // Logging must never prevent the meeting window from opening.
  }
}
