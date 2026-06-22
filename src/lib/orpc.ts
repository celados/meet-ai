import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import type { RouterClient } from '@orpc/server'
import type { AppRouter } from '~/server/orpc/router'

const link = new RPCLink({
  url: '/rpc',
})

export const client: RouterClient<AppRouter> = createORPCClient(link)
export const orpc = createTanstackQueryUtils(client)
