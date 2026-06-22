import { os } from '@orpc/server'

export type ORPCContext = {
  headers: Headers
}

export const publicProcedure = os.$context<ORPCContext>()
