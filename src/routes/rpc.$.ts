import { createFileRoute } from '@tanstack/react-router'
import { handleRpcRequest } from '~/server/orpc/handler'

export const Route = createFileRoute('/rpc/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleRpcRequest(request),
      POST: ({ request }) => handleRpcRequest(request),
    },
  },
})
