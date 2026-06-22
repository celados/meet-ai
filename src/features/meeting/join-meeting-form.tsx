import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Plus, Video } from 'lucide-react'
import * as React from 'react'
import { orpc } from '~/lib/orpc'
import type { MeetingSession } from './types'

type JoinMeetingFormProps = {
  initialMeetingId?: string
  onSessionReady: (session: MeetingSession) => void
}

export function JoinMeetingForm({
  initialMeetingId,
  onSessionReady,
}: JoinMeetingFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = React.useState('')
  const [meetingId, setMeetingId] = React.useState(initialMeetingId ?? '')

  React.useEffect(() => {
    setMeetingId(initialMeetingId ?? '')
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

  function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMeeting.mutate({ name: name.trim() })
  }

  function submitJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    joinMeeting.mutate({ name: name.trim(), meetingId: meetingId.trim() })
  }

  return (
    <div className="join-stack">
      <label className="field">
        <span>Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={1}
          maxLength={80}
          placeholder="Ada"
          autoComplete="name"
        />
      </label>

      <form className="action-form" onSubmit={submitCreate}>
        <button
          className="primary-button"
          type="submit"
          disabled={pending || name.trim().length === 0}
        >
          <Plus size={18} aria-hidden="true" />
          Create meeting
        </button>
      </form>

      <form className="join-form" onSubmit={submitJoin}>
        <label className="field">
          <span>Meeting ID</span>
          <input
            value={meetingId}
            onChange={(event) => setMeetingId(event.target.value)}
            placeholder="RealtimeKit meeting id"
            autoComplete="off"
          />
        </label>
        <button
          className="secondary-button"
          type="submit"
          disabled={
            pending || name.trim().length === 0 || meetingId.trim().length === 0
          }
        >
          {initialMeetingId ? (
            <Video size={18} aria-hidden="true" />
          ) : (
            <Link size={18} aria-hidden="true" />
          )}
          Join meeting
        </button>
      </form>

      {error ? <p className="error-text">{getErrorMessage(error)}</p> : null}
    </div>
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Request failed.'
}
