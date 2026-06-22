import { useQuery } from '@tanstack/react-query'
import { Download, FileAudio, FileVideo, HardDrive, Loader2, Timer } from 'lucide-react'
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
  const status = data?.status ?? 'NO_RECORDING'
  const statusMeta = getStatusMeta(status)

  return (
    <div className={`recording-status panel status-card status-${status.toLowerCase()}`}>
      <div className="panel-heading">
        <div>
          <p className="field-label">Status</p>
          <h2>{statusMeta.title}</h2>
        </div>
        {statusQuery.isFetching ? (
          <Loader2 className="spin subtle" size={16} aria-hidden="true" />
        ) : null}
      </div>

      <div className={`status-badge status-${status.toLowerCase()}`}>
        {statusMeta.label}
      </div>
      <p className="status-copy">{statusMeta.copy}</p>

      {recording ? (
        <dl className="recording-meta">
          <div>
            <dt>Recording ID</dt>
            <dd title={recording.id}>{recording.id}</dd>
          </div>
          {recording.fileSize ? (
            <div>
              <dt>
                <HardDrive size={13} aria-hidden="true" />
                Size
              </dt>
              <dd>{formatBytes(recording.fileSize)}</dd>
            </div>
          ) : null}
          {recording.durationSeconds ? (
            <div>
              <dt>
                <Timer size={13} aria-hidden="true" />
                Duration
              </dt>
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
            <FileVideo size={16} aria-hidden="true" />
            Video
            <Download size={15} aria-hidden="true" />
          </a>
        ) : null}
        {recording?.audioDownloadUrl ? (
          <a className="download-link" href={recording.audioDownloadUrl}>
            <FileAudio size={16} aria-hidden="true" />
            Audio
            <Download size={15} aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {statusQuery.error ? (
        <p className="error-text">{getErrorMessage(statusQuery.error)}</p>
      ) : null}
    </div>
  )
}

function getStatusMeta(status: string) {
  if (status === 'INVOKED') {
    return {
      title: 'Starting',
      label: 'INVOKED',
      copy: 'RealtimeKit accepted the request and is preparing the capture.',
    }
  }
  if (status === 'RECORDING') {
    return {
      title: 'Recording live',
      label: 'RECORDING',
      copy: 'The room is being captured now.',
    }
  }
  if (status === 'PAUSED') {
    return {
      title: 'Paused',
      label: 'PAUSED',
      copy: 'The provider has paused the active recording.',
    }
  }
  if (status === 'UPLOADING') {
    return {
      title: 'Saving file',
      label: 'UPLOADING',
      copy: 'The recording is processing before download links appear.',
    }
  }
  if (status === 'UPLOADED') {
    return {
      title: 'Ready',
      label: 'UPLOADED',
      copy: 'The latest recording is available below.',
    }
  }
  if (status === 'ERRORED') {
    return {
      title: 'Needs attention',
      label: 'ERRORED',
      copy: 'The latest recording could not finish cleanly.',
    }
  }
  return {
    title: 'Idle',
    label: 'NO RECORDING',
    copy: 'No capture has been started for this room.',
  }
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
