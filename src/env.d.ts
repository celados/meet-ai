/// <reference types="vite/client" />

import '@tanstack/react-start'

declare global {
  type MeetDesktopPermissionKind = 'microphone' | 'camera' | 'screen'
  type MeetDesktopPermissionState = 'ungranted' | 'inProgress' | 'granted'
  type MeetDesktopPermissionRawStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'

  interface MeetDesktopPermissionSnapshot {
    isDesktop: true
    platform: NodeJS.Platform
    permissions: Record<MeetDesktopPermissionKind, {
      state: MeetDesktopPermissionState
      status: MeetDesktopPermissionRawStatus
      canRequest: boolean
      canOpenSettings: boolean
      requiresRestart: boolean
    }>
  }

  interface Window {
    meetDesktop?: {
      getPermissions: () => Promise<MeetDesktopPermissionSnapshot | null>
      requestPermission: (kind: MeetDesktopPermissionKind) => Promise<MeetDesktopPermissionSnapshot | null>
      openPermissionSettings: (kind: MeetDesktopPermissionKind) => Promise<MeetDesktopPermissionSnapshot | null>
    }
  }

  namespace NodeJS {
    interface ProcessEnv {
      CF_ACCOUNT_ID?: string
      REALTIMEKIT_APP_ID?: string
      CLOUDFLARE_API_TOKEN?: string
      PUBLIC_APP_URL?: string
      REALTIMEKIT_PRESET_NAME?: string
      REALTIMEKIT_HOST_PRESET_NAME?: string
      REALTIMEKIT_PARTICIPANT_PRESET_NAME?: string
    }
  }
}

export {}
