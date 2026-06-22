import { meetingRouter } from './routers/meeting'
import { recordingRouter } from './routers/recording'

export const appRouter = {
  meeting: meetingRouter,
  recording: recordingRouter,
}

export type AppRouter = typeof appRouter
