import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { JoinMeetingForm } from '~/features/meeting/join-meeting-form'
import { MeetingRoom } from '~/features/meeting/meeting-room'
import { CopyInviteLink } from '~/features/meeting/copy-invite-link'
import { DesktopPermissionsPanel } from '~/features/desktop/desktop-permissions'
import type { MeetingSession } from '~/features/meeting/types'

type MeetingSearch = {
  meetingId?: string
}

export const Route = createFileRoute('/')({
  validateSearch: (search): MeetingSearch => ({
    meetingId: typeof search.meetingId === 'string' ? search.meetingId : undefined,
  }),
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [session, setSession] = React.useState<MeetingSession | null>(null)

  const meetingId = session?.meetingId ?? search.meetingId
  const inviteUrl = session?.inviteUrl

  const handleSession = React.useCallback(
    (nextSession: MeetingSession) => {
      setSession(nextSession)
      void navigate({
        search: (current) => ({
          ...current,
          meetingId: nextSession.meetingId,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="control-panel" aria-label="Meeting setup">
          <div className="brand-block">
            <img className="brand-mark" src="/brand/meet-ai-mark.svg" alt="" aria-hidden="true" />
            <div>
              <p className="eyebrow">Internal meeting</p>
              <h1>Meet AI</h1>
            </div>
          </div>

          <JoinMeetingForm
            initialMeetingId={search.meetingId}
            onSessionReady={handleSession}
          />

          <DesktopPermissionsPanel />

          {meetingId ? (
            <CopyInviteLink meetingId={meetingId} inviteUrl={inviteUrl} />
          ) : null}
        </aside>

        <MeetingRoom session={session} meetingId={meetingId} />
      </section>
    </main>
  )
}
