import { RPCHandler } from '@orpc/server/fetch'
import { appRouter } from './router'

const handler = new RPCHandler(appRouter)

export async function handleRpcRequest(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: '/rpc',
    context: {
      headers: request.headers,
    },
  })

  return response ?? new Response('Not found', { status: 404 })
}
