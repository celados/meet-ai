import { useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { orpc } from '~/lib/orpc'

type RecordingStatusProps = {
  meetingId: string
}

const pollingStatuses = new Set(['INVOKED', 'RECORDING', 'UPLOADING', 'PAUSED'])

export function RecordingStatus({ meetingId }: RecordingStatusProps) {
  const statusQuery = useQuery(
    orpc.recording.getStatus.queryOptions({
      input: { meetingId },
      refetchInterval: (query) => {
        const status = query.state.data?.status
        if (status && pollingStatuses.has(status)) return 3_000
        return false
      },
      refetchIntervalInBackground: true,
    }),
  )

  const data = statusQuery.data
  const recording = data?.recording

  return (
    <div className="recording-status panel">
      <div className="panel-heading">
        <p className="field-label">Status</p>
        {statusQuery.isFetching ? (
          <Loader2 className="spin subtle" size={16} aria-hidden="true" />
        ) : null}
      </div>

      <div className={`status-badge status-${(data?.status ?? 'none').toLowerCase()}`}>
        {data?.status ?? 'NO_RECORDING'}
      </div>

      {recording ? (
        <dl className="recording-meta">
          <div>
            <dt>Recording ID</dt>
            <dd title={recording.id}>{recording.id}</dd>
          </div>
          {recording.fileSize ? (
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(recording.fileSize)}</dd>
            </div>
          ) : null}
          {recording.durationSeconds ? (
            <div>
              <dt>Duration</dt>
              <dd>{Math.round(recording.durationSeconds)}s</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="muted-line">No recording for this meeting yet.</p>
      )}

      <div className="download-list">
        {recording?.downloadUrl ? (
          <a className="download-link" href={recording.downloadUrl}>
            <Download size={16} aria-hidden="true" />
            Video file
          </a>
        ) : null}
        {recording?.audioDownloadUrl ? (
          <a className="download-link" href={recording.audioDownloadUrl}>
            <Download size={16} aria-hidden="true" />
            Audio file
          </a>
        ) : null}
      </div>

      {statusQuery.error ? (
        <p className="error-text">{getErrorMessage(statusQuery.error)}</p>
      ) : null}
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Unable to load recording status.'
}
