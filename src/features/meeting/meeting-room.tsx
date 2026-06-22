import * as React from 'react'
import { Hash, RadioTower, UserRound } from 'lucide-react'
import { CopyInviteLink } from '~/features/meeting/copy-invite-link'
import { RecordingControls } from '~/features/recording/recording-controls'
import { RecordingStatus } from '~/features/recording/recording-status'
import type { MeetingSession } from './types'

const RealtimeKitMeeting = React.lazy(() => import('./realtimekit-meeting'))

type MeetingRoomProps = {
  session: MeetingSession | null
  meetingId?: string
  inviteUrl?: string
}

export function MeetingRoom({ session, meetingId, inviteUrl }: MeetingRoomProps) {
  const phase = session ? 'live' : meetingId ? 'ready' : 'start'

  return (
    <section className={`meeting-room meeting-phase-${phase}`} aria-label="Meeting room">
      <div className="meeting-stage">
        {session ? (
          <React.Suspense fallback={<StagePlaceholder phase="loading" />}>
            <RealtimeKitMeeting authToken={session.authToken} />
          </React.Suspense>
        ) : (
          <StagePlaceholder phase={meetingId ? 'ready' : 'start'} />
        )}
      </div>

      <aside className="session-rail" aria-label="Session status">
        {meetingId ? (
          <>
            <SessionCard meetingId={meetingId} participantName={session?.participantName} />
            <CopyInviteLink meetingId={meetingId} inviteUrl={inviteUrl} />
            {session ? (
              <>
                <RecordingControls meetingId={meetingId} />
                <RecordingStatus meetingId={meetingId} />
              </>
            ) : (
              <div className="recording-standby panel">
                <RadioTower size={18} aria-hidden="true" />
                <div>
                  <p className="field-label">Recording</p>
                  <p>Recording controls appear after you enter the room.</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="session-empty panel">
            <RadioTower size={18} aria-hidden="true" />
            <div>
              <p className="field-label">Session</p>
              <p>No room is active yet.</p>
            </div>
          </div>
        )}
      </aside>
    </section>
  )
}

function StagePlaceholder({
  phase,
}: {
  phase: 'start' | 'ready' | 'loading'
}) {
  const ready = phase === 'ready'
  const loading = phase === 'loading'

  return (
    <div className="meeting-placeholder">
      <div className="stage-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="signal-label">{loading ? 'Connecting' : ready ? 'Room ready' : 'No signal'}</p>
      <h2>
        {loading
          ? 'Preparing media...'
          : ready
            ? 'Enter when you are ready.'
            : 'Create or join a room.'}
      </h2>
      <p>
        {loading
          ? 'Camera and microphone setup will appear inside the meeting.'
          : ready
            ? 'Your invite is loaded. Add your name in the entry card.'
            : 'The meeting canvas will stay dark until a room is selected.'}
      </p>
    </div>
  )
}

function SessionCard({
  meetingId,
  participantName,
}: {
  meetingId: string
  participantName?: string
}) {
  return (
    <div className="session-card panel">
      <div className="panel-heading compact">
        <div>
          <p className="field-label">Session</p>
          <h2>{participantName ? 'Live room' : 'Room selected'}</h2>
        </div>
        <span className={participantName ? 'live-pill' : 'ready-pill'}>
          {participantName ? 'Live' : 'Ready'}
        </span>
      </div>
      <div className="session-data">
        <div className="session-data-row">
          <Hash size={15} aria-hidden="true" />
          <span title={meetingId}>{meetingId}</span>
        </div>
        <div className="session-data-row">
          <UserRound size={15} aria-hidden="true" />
          <span>{participantName ?? 'Not joined'}</span>
        </div>
      </div>
    </div>
  )
}
