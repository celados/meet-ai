import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const outputDir = join(rootDir, 'dist', 'desktop-app')
const entitlementsPath = join(outputDir, 'entitlements.mac.plist')
const notarizeScriptPath = join(rootDir, 'desktop', 'notarize.cjs')
const desktopIconPath = join(rootDir, 'desktop', 'assets', 'icon.icns')
const shouldSignMac = process.env.MEET_DESKTOP_SIGN === '1'
const rootPackage = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8')) as {
  version?: string
  description?: string
  author?: string
  devDependencies?: Record<string, string>
}

const electronVersion = stripRangePrefix(rootPackage.devDependencies?.electron ?? '')

if (!electronVersion) {
  throw new Error('Unable to determine Electron version from package.json devDependencies.electron')
}

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

await copyFile(join(rootDir, 'dist', 'desktop', 'main.cjs'), join(outputDir, 'main.cjs'))
await copyFile(join(rootDir, 'dist', 'desktop', 'preload.cjs'), join(outputDir, 'preload.cjs'))
await copyFile(join(rootDir, 'desktop', 'entitlements.mac.plist'), entitlementsPath)

await writeFile(
  join(outputDir, 'package.json'),
  JSON.stringify(createDesktopPackageJson(electronVersion), null, 2) + '\n',
)

function createDesktopPackageJson(electronVersionValue: string) {
  return {
    name: 'meet-ai-desktop',
    version: rootPackage.version ?? '0.1.0',
    description: rootPackage.description ?? 'Meet AI desktop app.',
    author: rootPackage.author ?? 'Celados',
    private: true,
    main: 'main.cjs',
    dependencies: {},
    devDependencies: {
      electron: electronVersionValue,
    },
    build: {
      appId: 'com.celados.meetai',
      productName: 'Meet AI',
      electronVersion: electronVersionValue,
      icon: desktopIconPath,
      npmRebuild: false,
      nodeGypRebuild: false,
      afterSign: notarizeScriptPath,
      directories: {
        output: '../../release/desktop',
      },
      files: [
        'main.cjs',
        'preload.cjs',
        'package.json',
      ],
      asar: true,
      mac: {
        category: 'public.app-category.business',
        notarize: false,
        ...(shouldSignMac
          ? {
              hardenedRuntime: true,
              entitlements: entitlementsPath,
              entitlementsInherit: entitlementsPath,
            }
          : {
              identity: null,
              hardenedRuntime: false,
            }),
        extendInfo: {
          NSAppTransportSecurity: {
            NSAllowsArbitraryLoads: false,
            NSAllowsLocalNetworking: true,
            NSExceptionDomains: {
              '127.0.0.1': {
                NSIncludesSubdomains: false,
                NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
                NSTemporaryExceptionAllowsInsecureHTTPSLoads: false,
              },
              localhost: {
                NSIncludesSubdomains: false,
                NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
                NSTemporaryExceptionAllowsInsecureHTTPSLoads: false,
              },
            },
          },
          NSCameraUsageDescription: 'Meet AI needs camera access for video meetings.',
          NSMicrophoneUsageDescription: 'Meet AI needs microphone access for audio meetings.',
          NSScreenCaptureUsageDescription: 'Meet AI needs screen recording permission to share your screen.',
          NSAudioCaptureUsageDescription: 'Meet AI may need audio capture permission when sharing screen audio.',
        },
      },
      win: {
        target: 'nsis',
      },
      linux: {
        target: 'AppImage',
        category: 'Network',
      },
    },
  }
}

function stripRangePrefix(versionRange: string) {
  return versionRange.replace(/^[^\d]*/, '').trim()
}
