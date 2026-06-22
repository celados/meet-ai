import { ORPCError } from '@orpc/server'
import type {
  NormalizedMeeting,
  NormalizedParticipant,
  NormalizedRecording,
  RealtimeKitRecordingStatus,
} from './types'

const API_BASE = 'https://api.cloudflare.com/client/v4'

type CloudflareEnvelope<T> = {
  success: boolean
  data?: T
  errors?: Array<{
    code?: string | number
    message?: string
  }>
}

type RawMeeting = {
  id: string
  title?: string
  status?: 'ACTIVE' | 'INACTIVE'
  created_at?: string
}

type RawParticipant = {
  id: string
  token: string
  name?: string
  preset_name?: string
}

type RawRecording = {
  id: string
  status: RealtimeKitRecordingStatus
  download_url?: string
  audio_download_url?: string
  download_url_expiry?: string
  file_size?: number
  recording_duration?: number
  output_file_name?: string
  invoked_time?: string
  started_time?: string
  stopped_time?: string
}

export type CreateMeetingInput = {
  title: string
}

export type AddParticipantInput = {
  meetingId: string
  name: string
  host: boolean
}

export async function createRealtimeKitMeeting(input: CreateMeetingInput) {
  const meeting = await realtimeKitFetch<RawMeeting>('/meetings', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      recording_config: {
        video_config: {
          codec: 'H264',
        },
        audio_config: {
          codec: 'AAC',
          channel: 'stereo',
        },
      },
      session_keep_alive_time_in_secs: 60,
    }),
  })

  return normalizeMeeting(requireData(meeting, 'RealtimeKit did not return a meeting.'))
}

export async function getRealtimeKitMeeting(meetingId: string) {
  const meeting = await realtimeKitFetch<RawMeeting>(`/meetings/${meetingId}`)
  return normalizeMeeting(requireData(meeting, 'RealtimeKit did not return a meeting.'))
}

export async function addRealtimeKitParticipant(input: AddParticipantInput) {
  const participant = await realtimeKitFetch<RawParticipant>(
    `/meetings/${input.meetingId}/participants`,
    {
      method: 'POST',
      body: JSON.stringify({
        custom_participant_id: `web-${crypto.randomUUID()}`,
        preset_name: getPresetName(input.host),
        name: input.name,
      }),
    },
  )

  return normalizeParticipant(
    requireData(participant, 'RealtimeKit did not return a participant token.'),
  )
}

export async function startRealtimeKitRecording(meetingId: string) {
  const active = await getActiveRealtimeKitRecording(meetingId).catch((error) => {
    if (error instanceof RealtimeKitApiError && error.statusCode === 404) return null
    throw error
  })

  if (active) return active

  const recording = await realtimeKitFetch<RawRecording>('/recordings', {
    method: 'POST',
    body: JSON.stringify({
      meeting_id: meetingId,
      file_name_prefix: `meet_ai_${meetingId.replaceAll('-', '_')}`,
      video_config: {
        codec: 'H264',
      },
      audio_config: {
        codec: 'AAC',
        channel: 'stereo',
      },
    }),
  })

  return normalizeRecording(
    requireData(recording, 'RealtimeKit did not return a recording.'),
  )
}

export async function stopRealtimeKitRecording(input: {
  meetingId: string
  recordingId?: string
}) {
  const activeRecording = input.recordingId
    ? null
    : await findActiveRealtimeKitRecording(input.meetingId)
  const recordingId = input.recordingId ?? activeRecording?.id

  if (!recordingId) {
    const latest = await getLatestRealtimeKitRecordingForMeeting(input.meetingId)
    if (latest && isStopSettledRecordingStatus(latest.status)) return latest

    throw new ORPCError('BAD_REQUEST', {
      message: 'No active recording was found for this meeting.',
    })
  }

  try {
    const recording = await realtimeKitFetch<RawRecording>(`/recordings/${recordingId}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'stop' }),
    })

    return normalizeRecording(
      requireData(recording, 'RealtimeKit did not return a recording.'),
    )
  } catch (error) {
    if (error instanceof RealtimeKitApiError) {
      const latest = await getLatestRealtimeKitRecordingForMeeting(input.meetingId)
      if (latest?.id === recordingId && isStopSettledRecordingStatus(latest.status)) {
        return latest
      }
    }

    throw error
  }
}

export async function listRealtimeKitRecordings(meetingId: string) {
  const params = new URLSearchParams({
    meeting_id: meetingId,
    per_page: '20',
    page_no: '1',
    sort_by: 'invokedTime',
    sort_order: 'DESC',
  })
  const recordings = await realtimeKitFetch<RawRecording[]>(
    `/recordings?${params.toString()}`,
  )

  return (recordings ?? []).map(normalizeRecording)
}

export async function getRealtimeKitRecording(recordingId: string) {
  const recording = await realtimeKitFetch<RawRecording>(`/recordings/${recordingId}`)
  return normalizeRecording(
    requireData(recording, 'RealtimeKit did not return a recording.'),
  )
}

export async function getActiveRealtimeKitRecording(meetingId: string) {
  const recording = await realtimeKitFetch<RawRecording>(
    `/recordings/active-recording/${meetingId}`,
  )
  return normalizeRecording(
    requireData(recording, 'RealtimeKit did not return an active recording.'),
  )
}

export function buildInviteUrl(meetingId: string) {
  const configured = requireServerEnv('PUBLIC_APP_URL')
  const base = configured.startsWith('http') ? configured : `https://${configured}`
  const url = new URL(base)
  url.searchParams.set('meetingId', meetingId)
  return url.toString()
}

async function findActiveRealtimeKitRecording(meetingId: string) {
  return getActiveRealtimeKitRecording(meetingId).catch(async (error) => {
    if (!(error instanceof RealtimeKitApiError) || error.statusCode !== 404) {
      throw error
    }

    const recordings = await listRealtimeKitRecordings(meetingId)
    return recordings.find((recording) => isActiveRecordingStatus(recording.status)) ?? null
  })
}

async function getLatestRealtimeKitRecordingForMeeting(meetingId: string) {
  const recordings = await listRealtimeKitRecordings(meetingId)
  return recordings[0] ?? null
}

function isActiveRecordingStatus(status: RealtimeKitRecordingStatus) {
  return status === 'INVOKED' || status === 'RECORDING' || status === 'PAUSED'
}

function isStopSettledRecordingStatus(status: RealtimeKitRecordingStatus) {
  return status === 'UPLOADING' || status === 'UPLOADED' || status === 'ERRORED'
}

async function realtimeKitFetch<T>(path: string, init: RequestInit = {}) {
  const config = getRealtimeKitConfig()
  const response = await fetch(
    `${API_BASE}/accounts/${config.accountId}/realtime/kit/${config.appId}${path}`,
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiToken}`,
        ...init.headers,
      },
    },
  )

  let body: CloudflareEnvelope<T> | null = null
  try {
    body = (await response.json()) as CloudflareEnvelope<T>
  } catch {
    body = null
  }

  if (!response.ok || body?.success === false) {
    const message =
      body?.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join('; ') || `Cloudflare RealtimeKit request failed with ${response.status}.`

    throw new RealtimeKitApiError(message, response.status)
  }

  return body?.data as T
}

function getRealtimeKitConfig() {
  return {
    accountId: requireServerEnv('CF_ACCOUNT_ID'),
    appId: requireServerEnv('REALTIMEKIT_APP_ID'),
    apiToken: requireServerEnv('CLOUDFLARE_API_TOKEN'),
  }
}

function requireServerEnv(key: keyof NodeJS.ProcessEnv) {
  const value = process.env[key]
  if (!value) {
    throw new ORPCError('INTERNAL_SERVER_ERROR', {
      message: `Missing required server environment variable: ${key}`,
    })
  }
  return value
}

function getPresetName(host: boolean) {
  const roleSpecific = host
    ? process.env.REALTIMEKIT_HOST_PRESET_NAME
    : process.env.REALTIMEKIT_PARTICIPANT_PRESET_NAME

  return roleSpecific ?? process.env.REALTIMEKIT_PRESET_NAME ?? 'group_call_host'
}

function requireData<T>(data: T | undefined, message: string) {
  if (!data) {
    throw new ORPCError('INTERNAL_SERVER_ERROR', { message })
  }
  return data
}

function normalizeMeeting(meeting: RawMeeting): NormalizedMeeting {
  return {
    id: meeting.id,
    title: meeting.title ?? null,
    status: meeting.status ?? null,
    createdAt: meeting.created_at ?? null,
  }
}

function normalizeParticipant(participant: RawParticipant): NormalizedParticipant {
  return {
    id: participant.id,
    token: participant.token,
    name: participant.name ?? 'Guest',
    presetName: participant.preset_name ?? getPresetName(false),
  }
}

function normalizeRecording(recording: RawRecording): NormalizedRecording {
  return {
    id: recording.id,
    status: recording.status,
    downloadUrl: recording.download_url ?? null,
    audioDownloadUrl: recording.audio_download_url ?? null,
    downloadUrlExpiry: recording.download_url_expiry ?? null,
    fileSize: recording.file_size ?? null,
    durationSeconds: recording.recording_duration ?? null,
    outputFileName: recording.output_file_name ?? null,
    invokedAt: recording.invoked_time ?? null,
    startedAt: recording.started_time ?? null,
    stoppedAt: recording.stopped_time ?? null,
  }
}

class RealtimeKitApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = 'RealtimeKitApiError'
  }
}
