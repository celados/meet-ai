import { contextBridge, ipcRenderer } from 'electron'

const DESKTOP_PERMISSION_KINDS = ['microphone', 'camera', 'screen'] as const

type DesktopPermissionKind = typeof DESKTOP_PERMISSION_KINDS[number]

function isDesktopPermissionKind(value: unknown): value is DesktopPermissionKind {
  return typeof value === 'string' && DESKTOP_PERMISSION_KINDS.includes(value as DesktopPermissionKind)
}

const meetDesktop = {
  getPermissions: () => ipcRenderer.invoke('meet-ai:permissions:get'),
  requestPermission: (kind: DesktopPermissionKind) => {
    if (!isDesktopPermissionKind(kind)) return Promise.resolve(null)
    return ipcRenderer.invoke('meet-ai:permissions:request', kind)
  },
  openPermissionSettings: (kind: DesktopPermissionKind) => {
    if (!isDesktopPermissionKind(kind)) return Promise.resolve(null)
    return ipcRenderer.invoke('meet-ai:permissions:open-settings', kind)
  },
}

contextBridge.exposeInMainWorld('meetDesktop', meetDesktop)
