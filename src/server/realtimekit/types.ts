export type RealtimeKitRecordingStatus =
  | 'INVOKED'
  | 'RECORDING'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'ERRORED'
  | 'PAUSED'

export type NormalizedMeeting = {
  id: string
  title: string | null
  status: 'ACTIVE' | 'INACTIVE' | null
  createdAt: string | null
}

export type NormalizedParticipant = {
  id: string
  token: string
  name: string
  presetName: string
}

export type NormalizedRecording = {
  id: string
  status: RealtimeKitRecordingStatus
  downloadUrl: string | null
  audioDownloadUrl: string | null
  downloadUrlExpiry: string | null
  fileSize: number | null
  durationSeconds: number | null
  outputFileName: string | null
  invokedAt: string | null
  startedAt: string | null
  stoppedAt: string | null
}

export type RecordingStatusOutput = {
  meetingId: string
  status: RealtimeKitRecordingStatus | 'NO_RECORDING'
  recording: NormalizedRecording | null
}
