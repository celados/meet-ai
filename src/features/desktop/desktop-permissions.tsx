import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Camera,
  Check,
  LoaderCircle,
  Mic,
  MonitorUp,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import * as React from 'react'

const permissionItems = [
  {
    kind: 'microphone',
    title: 'Microphone',
    description: 'Required for meeting audio.',
    Icon: Mic,
  },
  {
    kind: 'camera',
    title: 'Camera',
    description: 'Required for video calls.',
    Icon: Camera,
  },
  {
    kind: 'screen',
    title: 'Screen Recording',
    description: 'Required for screen sharing.',
    Icon: MonitorUp,
  },
] as const satisfies Array<{
  kind: MeetDesktopPermissionKind
  title: string
  description: string
  Icon: React.ComponentType<{ size?: number }>
}>

const permissionsQueryKey = ['desktop', 'permissions'] as const

export function DesktopPermissionsPanel() {
  const queryClient = useQueryClient()
  const [isDesktop, setIsDesktop] = React.useState(false)

  React.useEffect(() => {
    setIsDesktop(Boolean(window.meetDesktop))
  }, [])

  const permissions = useQuery({
    queryKey: permissionsQueryKey,
    enabled: isDesktop,
    queryFn: () => window.meetDesktop?.getPermissions() ?? Promise.resolve(null),
    refetchInterval: 1500,
    placeholderData: (previous) => previous,
  })

  const requestPermission = useMutation({
    mutationFn: (kind: MeetDesktopPermissionKind) =>
      window.meetDesktop?.requestPermission(kind) ?? Promise.resolve(null),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(permissionsQueryKey, snapshot)
      void queryClient.invalidateQueries({ queryKey: permissionsQueryKey })
    },
  })

  const openSettings = useMutation({
    mutationFn: (kind: MeetDesktopPermissionKind) =>
      window.meetDesktop?.openPermissionSettings(kind) ?? Promise.resolve(null),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(permissionsQueryKey, snapshot)
      void queryClient.invalidateQueries({ queryKey: permissionsQueryKey })
    },
  })

  if (!isDesktop) return null

  const snapshot = permissions.data
  const grantedCount = permissionItems.filter(
    ({ kind }) => snapshot?.permissions[kind]?.state === 'granted',
  ).length
  const allGranted = Boolean(snapshot) && grantedCount === permissionItems.length

  return (
    <section
      className={allGranted ? 'desktop-permissions panel is-ready' : 'desktop-permissions panel'}
      aria-label="Desktop permissions"
    >
      <div className="panel-heading">
        <div>
          <p className="field-label">Desktop</p>
          <h2>Device access</h2>
        </div>
        <span className={allGranted ? 'readiness-pill is-ready' : 'readiness-pill'}>
          {allGranted ? 'Ready' : `${grantedCount}/${permissionItems.length}`}
        </span>
      </div>

      {allGranted ? (
        <div className="permission-ready-row">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Camera, microphone, and screen access are available.</span>
        </div>
      ) : (
        <div className="permission-list">
          {permissionItems.map(({ kind, title, description, Icon }) => {
            const item = snapshot?.permissions[kind]
            const pending = requestPermission.isPending && requestPermission.variables === kind
            const opening = openSettings.isPending && openSettings.variables === kind
            const busy = pending || opening || !item || item.state === 'inProgress'
            const granted = item?.state === 'granted'

            return (
              <div
                className={granted ? 'permission-row is-granted' : 'permission-row'}
                key={kind}
              >
                <div className="permission-icon" aria-hidden="true">
                  {granted ? <Check size={17} /> : <Icon size={17} />}
                </div>
                <div className="permission-copy">
                  <strong>{title}</strong>
                  <span>{description}</span>
                  {item?.requiresRestart ? (
                    <span className="permission-note">
                      Restart the app after changing this in System Settings.
                    </span>
                  ) : null}
                  {!item && permissions.isError ? (
                    <span className="permission-note">
                      <AlertCircle size={13} aria-hidden="true" />
                      Permission status unavailable.
                    </span>
                  ) : null}
                </div>
                <PermissionAction
                  busy={busy}
                  canOpenSettings={Boolean(item?.canOpenSettings)}
                  canRequest={Boolean(item?.canRequest)}
                  granted={granted}
                  onOpenSettings={() => openSettings.mutate(kind)}
                  onRequest={() => requestPermission.mutate(kind)}
                />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function PermissionAction(props: {
  busy: boolean
  canOpenSettings: boolean
  canRequest: boolean
  granted: boolean
  onOpenSettings: () => void
  onRequest: () => void
}) {
  const { busy, canOpenSettings, canRequest, granted, onOpenSettings, onRequest } = props

  if (granted) {
    return (
      <span className="permission-state granted">
        <Check size={15} />
        Granted
      </span>
    )
  }

  if (busy) {
    return (
      <span className="permission-state">
        <LoaderCircle className="spin" size={15} />
        Waiting
      </span>
    )
  }

  return (
    <button
      className="secondary-button permission-button"
      type="button"
      onClick={canRequest ? onRequest : onOpenSettings}
      disabled={!canRequest && !canOpenSettings}
    >
      <Settings size={15} />
      {canRequest ? 'Grant' : 'Settings'}
    </button>
  )
}
