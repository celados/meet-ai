import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Radio, Square } from 'lucide-react'
import { orpc } from '~/lib/orpc'

type RecordingControlsProps = {
  meetingId: string
}

const activeRecordingStatuses = new Set(['INVOKED', 'RECORDING', 'PAUSED'])
const settledRecordingStatuses = new Set(['UPLOADING', 'UPLOADED', 'ERRORED'])

export function RecordingControls({ meetingId }: RecordingControlsProps) {
  const queryClient = useQueryClient()
  const statusQuery = useQuery(
    orpc.recording.getStatus.queryOptions({
      input: { meetingId },
      refetchInterval: (query) => {
        const status = query.state.data?.status
        if (status && activeRecordingStatuses.has(status)) return 3_000
        return false
      },
      refetchIntervalInBackground: true,
    }),
  )

  const startRecording = useMutation(
    orpc.recording.start.mutationOptions({
      onSuccess: () => invalidateRecordingStatus(queryClient, meetingId),
    }),
  )

  const stopRecording = useMutation(
    orpc.recording.stop.mutationOptions({
      onSuccess: () => invalidateRecordingStatus(queryClient, meetingId),
    }),
  )

  const pending = startRecording.isPending || stopRecording.isPending
  const isSettled = settledRecordingStatuses.has(statusQuery.data?.status ?? '')
  const error = isSettled ? null : (startRecording.error ?? stopRecording.error)
  const activeRecordingId = activeRecordingStatuses.has(statusQuery.data?.status ?? '')
    ? statusQuery.data?.recording?.id
    : undefined

  return (
    <div className="recording-controls panel">
      <div className="panel-heading">
        <p className="field-label">Recording</p>
      </div>
      <div className="button-grid">
        <button
          type="button"
          className="primary-button danger"
          disabled={pending}
          onClick={() => {
            startRecording.reset()
            stopRecording.reset()
            startRecording.mutate({ meetingId })
          }}
        >
          {startRecording.isPending ? (
            <Loader2 className="spin" size={18} aria-hidden="true" />
          ) : (
            <Radio size={18} aria-hidden="true" />
          )}
          Start
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={pending}
          onClick={() => {
            startRecording.reset()
            stopRecording.reset()
            stopRecording.mutate({ meetingId, recordingId: activeRecordingId })
          }}
        >
          {stopRecording.isPending ? (
            <Loader2 className="spin" size={18} aria-hidden="true" />
          ) : (
            <Square size={18} aria-hidden="true" />
          )}
          Stop
        </button>
      </div>
      {error ? <p className="error-text">{getErrorMessage(error)}</p> : null}
    </div>
  )
}

function invalidateRecordingStatus(
  queryClient: ReturnType<typeof useQueryClient>,
  meetingId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: orpc.recording.key(),
  })
  void queryClient.invalidateQueries({
    queryKey: orpc.recording.getStatus.key({ input: { meetingId } }),
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Recording request failed.'
}
