import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './trpc.router.js'
import { createTrpcContext, createTrpcContextFromJwt } from './trpc.context.js'

export function createTrpcFetchHandler(endpoint = '/trpc') {
  return async (req: Request): Promise<Response> => {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    return fetchRequestHandler({
      endpoint,
      req,
      router: appRouter,
      createContext: async () => jwt
        ? createTrpcContextFromJwt(jwt)
        : createTrpcContext({}),
    })
  }
}

