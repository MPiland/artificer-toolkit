import { api } from '@artificer-toolkit/apis/convex/api'
import { getFunctionName } from 'convex/server'
import { nodeRuntimeResolveRequestDtoSchema } from '@artificer-toolkit/schema/api/nodeRuntime'
import { compactNodeRuntimeResponse } from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import type { QueryClient } from '@tanstack/react-query'
import { resolveFixtureNodeRuntime } from './nodeRuntimeResolver'

export function configureAuthoredRouteStoryQueries(queryClient: QueryClient) {
  queryClient.setQueryDefaults(
    ['convexQuery', getFunctionName(api.authoring.nodeRuntime.resolve)],
    {
      queryFn: async ({ queryKey }) =>
        compactNodeRuntimeResponse(
          await resolveFixtureNodeRuntime(nodeRuntimeResolveRequestDtoSchema.parse(queryKey[2]))
        )
    }
  )
}
