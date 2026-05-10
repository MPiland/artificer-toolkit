import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './router.js'
import type { TrpcContext } from './dbContext.js'

export function handleTrpcFetchRequest(request: Request, context: TrpcContext): Promise<Response> {
  return fetchRequestHandler({
    createContext: () => context,
    endpoint: '/api/trpc',
    req: request,
    router: appRouter
  })
}

export type { TrpcContext }
