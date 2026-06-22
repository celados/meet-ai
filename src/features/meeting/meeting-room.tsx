import * as React from 'react'
import { RecordingControls } from '~/features/recording/recording-controls'
import { RecordingStatus } from '~/features/recording/recording-status'
import type { MeetingSession } from './types'

const RealtimeKitMeeting = React.lazy(() => import('./realtimekit-meeting'))

type MeetingRoomProps = {
  session: MeetingSession | null
  meetingId?: string
}

export function MeetingRoom({ session, meetingId }: MeetingRoomProps) {
  return (
    <section className="meeting-room" aria-label="Meeting room">
      <div className="meeting-stage">
        {session ? (
          <React.Suspense fallback={<div className="meeting-placeholder">Loading meeting...</div>}>
            <RealtimeKitMeeting authToken={session.authToken} />
          </React.Suspense>
        ) : (
          <div className="meeting-placeholder">
            <h2>{meetingId ? 'Join to enter this meeting' : 'No meeting selected'}</h2>
            <p>
              {meetingId
                ? 'Enter your name to receive a participant token.'
                : 'Create a room or open an invite link.'}
            </p>
          </div>
        )}
      </div>

      <div className="meeting-side">
        {meetingId ? (
          <>
            <MeetingControls meetingId={meetingId} participantName={session?.participantName} />
            <RecordingControls meetingId={meetingId} />
            <RecordingStatus meetingId={meetingId} />
          </>
        ) : (
          <div className="empty-panel">Recording status appears after a meeting exists.</div>
        )}
      </div>
    </section>
  )
}

function MeetingControls({
  meetingId,
  participantName,
}: {
  meetingId: string
  participantName?: string
}) {
  return (
    <div className="meeting-controls panel">
      <p className="field-label">Meeting</p>
      <div className="id-chip" title={meetingId}>
        {meetingId}
      </div>
      {participantName ? <p className="muted-line">Joined as {participantName}</p> : null}
    </div>
  )
}
