import { z } from 'zod'
import {
  addRealtimeKitParticipant,
  buildInviteUrl,
  createRealtimeKitMeeting,
  getRealtimeKitMeeting,
} from '~/server/realtimekit/client'
import { publicProcedure } from '../base'

const nameSchema = z.string().trim().min(1).max(80)
const meetingIdSchema = z.string().trim().min(8).max(160)

export const meetingRouter = {
  create: publicProcedure
    .input(
      z.object({
        name: nameSchema,
      }),
    )
    .handler(async ({ input }) => {
      const meeting = await createRealtimeKitMeeting({
        title: `Meet AI ${new Date().toISOString()}`,
      })
      const participant = await addRealtimeKitParticipant({
        meetingId: meeting.id,
        name: input.name,
        host: true,
      })

      return {
        meeting,
        participant,
        inviteUrl: buildInviteUrl(meeting.id),
      }
    }),

  join: publicProcedure
    .input(
      z.object({
        meetingId: meetingIdSchema,
        name: nameSchema,
      }),
    )
    .handler(async ({ input }) => {
      const meeting = await getRealtimeKitMeeting(input.meetingId)
      const participant = await addRealtimeKitParticipant({
        meetingId: meeting.id,
        name: input.name,
        host: false,
      })

      return {
        meeting,
        participant,
        inviteUrl: buildInviteUrl(meeting.id),
      }
    }),
}
