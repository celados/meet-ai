import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Link2, Loader2, LogIn, UserRound } from 'lucide-react'
import * as React from 'react'
import { orpc } from '~/lib/orpc'
import type { MeetingSession } from './types'

type JoinMeetingFormProps = {
  initialMeetingId?: string
  onSessionReady: (session: MeetingSession) => void
}

type JoinMode = 'create' | 'join'

export function JoinMeetingForm({
  initialMeetingId,
  onSessionReady,
}: JoinMeetingFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = React.useState('')
  const [meetingId, setMeetingId] = React.useState(initialMeetingId ?? '')
  const [mode, setMode] = React.useState<JoinMode>(initialMeetingId ? 'join' : 'create')

  React.useEffect(() => {
    setMeetingId(initialMeetingId ?? '')
    if (initialMeetingId) setMode('join')
  }, [initialMeetingId])

  const createMeeting = useMutation(
    orpc.meeting.create.mutationOptions({
      onSuccess: (data) => {
        onSessionReady({
          meetingId: data.meeting.id,
          participantId: data.participant.id,
          participantName: data.participant.name,
          authToken: data.participant.token,
          inviteUrl: data.inviteUrl,
        })
        void queryClient.invalidateQueries({
          queryKey: orpc.recording.getStatus.key({
            input: { meetingId: data.meeting.id },
          }),
        })
      },
    }),
  )

  const joinMeeting = useMutation(
    orpc.meeting.join.mutationOptions({
      onSuccess: (data) => {
        onSessionReady({
          meetingId: data.meeting.id,
          participantId: data.participant.id,
          participantName: data.participant.name,
          authToken: data.participant.token,
          inviteUrl: data.inviteUrl,
        })
        void queryClient.invalidateQueries({
          queryKey: orpc.recording.getStatus.key({
            input: { meetingId: data.meeting.id },
          }),
        })
      },
    }),
  )

  const pending = createMeeting.isPending || joinMeeting.isPending
  const error = createMeeting.error ?? joinMeeting.error
  const trimmedName = name.trim()
  const trimmedMeetingId = meetingId.trim()
  const isJoinMode = mode === 'join'
  const canSubmit =
    !pending &&
    trimmedName.length > 0 &&
    (!isJoinMode || trimmedMeetingId.length > 0)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMeeting.reset()
    joinMeeting.reset()
    if (isJoinMode) {
      joinMeeting.mutate({ name: trimmedName, meetingId: trimmedMeetingId })
      return
    }
    createMeeting.mutate({ name: trimmedName })
  }

  return (
    <form className="join-card panel" onSubmit={submit}>
      <div className="panel-heading">
        <div>
          <p className="field-label">Entry</p>
          <h2>{isJoinMode ? 'Join room' : 'Host room'}</h2>
        </div>
        <span className="mode-badge">{initialMeetingId ? 'Invite' : 'Manual'}</span>
      </div>

      {!initialMeetingId ? (
        <div className="mode-switch" role="group" aria-label="Meeting action">
          <button
            type="button"
            className={mode === 'create' ? 'is-active' : ''}
            aria-pressed={mode === 'create'}
            onClick={() => setMode('create')}
          >
            <CalendarPlus size={17} aria-hidden="true" />
            Host
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'is-active' : ''}
            aria-pressed={mode === 'join'}
            onClick={() => setMode('join')}
          >
            <Link2 size={17} aria-hidden="true" />
            Join
          </button>
        </div>
      ) : null}

      <label className="field identity-field">
        <span>Your name</span>
        <div className="input-shell">
          <UserRound size={17} aria-hidden="true" />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={1}
            maxLength={80}
            placeholder="Ada"
            autoComplete="name"
          />
        </div>
      </label>

      {isJoinMode ? (
        <label className="field">
          <span>Meeting ID</span>
          <div className="input-shell">
            <Link2 size={17} aria-hidden="true" />
            <input
              value={meetingId}
              onChange={(event) => setMeetingId(event.target.value)}
              placeholder="RealtimeKit meeting id"
              autoComplete="off"
            />
          </div>
        </label>
      ) : null}

      <button
        className={isJoinMode ? 'primary-button join-button' : 'primary-button'}
        type="submit"
        disabled={!canSubmit}
      >
        {pending ? (
          <Loader2 className="spin" size={18} aria-hidden="true" />
        ) : isJoinMode ? (
          <LogIn size={18} aria-hidden="true" />
        ) : (
          <CalendarPlus size={18} aria-hidden="true" />
        )}
        {getSubmitLabel({ isJoinMode, pending })}
      </button>

      {initialMeetingId ? (
        <p className="form-note">Meeting ID was loaded from the invite link.</p>
      ) : null}

      {error ? <p className="error-text">{getErrorMessage(error)}</p> : null}
    </form>
  )
}

function getSubmitLabel({
  isJoinMode,
  pending,
}: {
  isJoinMode: boolean
  pending: boolean
}) {
  if (pending) return isJoinMode ? 'Joining...' : 'Creating...'
  return isJoinMode ? 'Enter meeting' : 'Create meeting'
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Request failed.'
}
