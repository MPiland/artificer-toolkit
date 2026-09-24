import { QueryClient, type QueryFunctionContext } from '@tanstack/react-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import type { ConvexQueryClient } from '@convex-dev/react-query'

const authenticateSsrQueries = createIsomorphicFn()
  .server(async (convex: ConvexQueryClient) => {
    const { getRequest, setResponseHeader } = await import('@tanstack/react-start/server')
    const { createAuthenticatedConvexClient } = await import('#app/server/auth/convex.server')
    setResponseHeader('Cache-Control', 'private, no-store')
    convex.serverHttpClient = await createAuthenticatedConvexClient(getRequest())
  })
  .client(async (_convex: ConvexQueryClient) => {})

export function createAppQueryClient(convex?: ConvexQueryClient) {
  const convexQueryFn = convex?.queryFn()
  // One authentication exchange per request-local query client, including parallel loaders.
  // Keep rejection sticky: never retry a private read anonymously after failed authentication.
  let serverAuthentication: Promise<void> | undefined
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        ...(convex && convexQueryFn
          ? {
              queryKeyHashFn: convex.hashFn(),
              queryFn: async (context: QueryFunctionContext) => {
                if (convex.serverHttpClient) {
                  serverAuthentication ??= authenticateSsrQueries(convex)
                  await serverAuthentication
                }
                return convexQueryFn(context)
              }
            }
          : {}),
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1
      }
    }
  })
  convex?.connect(queryClient)
  return queryClient
}
