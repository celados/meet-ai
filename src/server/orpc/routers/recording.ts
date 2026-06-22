import { z } from 'zod'
import {
  getRealtimeKitRecording,
  listRealtimeKitRecordings,
  startRealtimeKitRecording,
  stopRealtimeKitRecording,
} from '~/server/realtimekit/client'
import type { RecordingStatusOutput } from '~/server/realtimekit/types'
import { publicProcedure } from '../base'

const meetingIdSchema = z.string().trim().min(8).max(160)
const recordingIdSchema = z.string().trim().min(8).max(160)

export const recordingRouter = {
  start: publicProcedure
    .input(
      z.object({
        meetingId: meetingIdSchema,
      }),
    )
    .handler(async ({ input }) => {
      const recording = await startRealtimeKitRecording(input.meetingId)
      return {
        meetingId: input.meetingId,
        recording,
      }
    }),

  stop: publicProcedure
    .input(
      z.object({
        meetingId: meetingIdSchema,
        recordingId: recordingIdSchema.optional(),
      }),
    )
    .handler(async ({ input }) => {
      const recording = await stopRealtimeKitRecording(input)
      return {
        meetingId: input.meetingId,
        recording,
      }
    }),

  list: publicProcedure
    .input(
      z.object({
        meetingId: meetingIdSchema,
      }),
    )
    .handler(async ({ input }) => {
      const recordings = await listRealtimeKitRecordings(input.meetingId)
      return {
        meetingId: input.meetingId,
        recordings,
      }
    }),

  getStatus: publicProcedure
    .input(
      z.object({
        meetingId: meetingIdSchema,
        recordingId: recordingIdSchema.optional(),
      }),
    )
    .handler(async ({ input }): Promise<RecordingStatusOutput> => {
      const recording = input.recordingId
        ? await getRealtimeKitRecording(input.recordingId)
        : (await listRealtimeKitRecordings(input.meetingId))[0]

      return {
        meetingId: input.meetingId,
        status: recording?.status ?? 'NO_RECORDING',
        recording: recording ?? null,
      }
    }),
}
