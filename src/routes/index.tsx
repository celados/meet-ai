import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { JoinMeetingForm } from '~/features/meeting/join-meeting-form'
import { MeetingRoom } from '~/features/meeting/meeting-room'
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
  const stage = session ? 'live' : meetingId ? 'ready' : 'start'

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
    <main className={`app-shell app-stage-${stage}`}>
      <section className="workspace" data-stage={stage}>
        <aside className="prep-panel" aria-label="Meeting setup">
          <div className="brand-block">
            <img className="brand-mark" src="/brand/meet-ai-mark.svg" alt="" aria-hidden="true" />
            <div>
              <p className="eyebrow">Celados internal</p>
              <h1>Meet AI</h1>
            </div>
          </div>

          <div className="prep-intro">
            <p className="signal-label">{getStageLabel(stage)}</p>
            <h2>{getStageTitle(stage)}</h2>
            <p>{getStageCopy(stage)}</p>
          </div>

          <JoinMeetingForm
            initialMeetingId={search.meetingId}
            onSessionReady={handleSession}
          />

          <DesktopPermissionsPanel />
        </aside>

        <MeetingRoom session={session} meetingId={meetingId} inviteUrl={inviteUrl} />
      </section>
    </main>
  )
}

function getStageLabel(stage: 'start' | 'ready' | 'live') {
  if (stage === 'live') return 'On deck'
  if (stage === 'ready') return 'Invite loaded'
  return 'Standby'
}

function getStageTitle(stage: 'start' | 'ready' | 'live') {
  if (stage === 'live') return 'You are in the room.'
  if (stage === 'ready') return 'Join this meeting.'
  return 'Start a focused room.'
}

function getStageCopy(stage: 'start' | 'ready' | 'live') {
  if (stage === 'live') return 'Keep the call in view while recording and invite actions stay close.'
  if (stage === 'ready') return 'Confirm your name and enter the room with the meeting already selected.'
  return 'Create a new room as host, or switch to join with an existing meeting ID.'
}
