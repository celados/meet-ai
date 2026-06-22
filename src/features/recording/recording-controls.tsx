import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleStop, Loader2, Radio } from 'lucide-react'
import { orpc } from '~/lib/orpc'

type RecordingControlsProps = {
  meetingId: string
}

const activeRecordingStatuses = new Set(['INVOKED', 'RECORDING', 'PAUSED'])
const settledRecordingStatuses = new Set(['UPLOADING', 'UPLOADED', 'ERRORED'])
const blockingRecordingStatuses = new Set(['INVOKED', 'RECORDING', 'PAUSED', 'UPLOADING'])

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
  const status = statusQuery.data?.status ?? 'NO_RECORDING'
  const isActive = activeRecordingStatuses.has(status)
  const isSettled = settledRecordingStatuses.has(statusQuery.data?.status ?? '')
  const error = isSettled ? null : (startRecording.error ?? stopRecording.error)
  const activeRecordingId = activeRecordingStatuses.has(status)
    ? statusQuery.data?.recording?.id
    : undefined
  const startDisabled = pending || blockingRecordingStatuses.has(status)
  const stopDisabled = pending || !isActive

  return (
    <div className={`recording-controls panel recording-state-${status.toLowerCase()}`}>
      <div className="panel-heading">
        <div>
          <p className="field-label">Recording</p>
          <h2>Capture</h2>
        </div>
        <span className={isActive ? 'live-pill' : 'ready-pill'}>
          {isActive ? 'Live' : getControlStateLabel(status)}
        </span>
      </div>
      <div className="recording-action-grid">
        <button
          type="button"
          className="primary-button record-button"
          disabled={startDisabled}
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
          Start recording
        </button>
        <button
          type="button"
          className={isActive ? 'secondary-button stop-button is-hot' : 'secondary-button stop-button'}
          disabled={stopDisabled}
          onClick={() => {
            startRecording.reset()
            stopRecording.reset()
            stopRecording.mutate({ meetingId, recordingId: activeRecordingId })
          }}
        >
          {stopRecording.isPending ? (
            <Loader2 className="spin" size={18} aria-hidden="true" />
          ) : (
            <CircleStop size={18} aria-hidden="true" />
          )}
          Stop
        </button>
      </div>
      <p className="control-hint">{getControlHint(status)}</p>
      {error ? <p className="error-text">{getErrorMessage(error)}</p> : null}
    </div>
  )
}

function getControlStateLabel(status: string) {
  if (status === 'UPLOADING') return 'Saving'
  if (status === 'UPLOADED') return 'Saved'
  if (status === 'ERRORED') return 'Error'
  return 'Idle'
}

function getControlHint(status: string) {
  if (status === 'INVOKED') return 'Recording is being initialized.'
  if (status === 'RECORDING') return 'Composite recording is running for this room.'
  if (status === 'PAUSED') return 'Recording is paused by the provider.'
  if (status === 'UPLOADING') return 'The latest recording is being processed.'
  if (status === 'UPLOADED') return 'The latest recording is ready to download.'
  if (status === 'ERRORED') return 'The latest recording needs attention.'
  return 'Start a composite recording when the session is ready.'
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
