import { api } from '@artificer-toolkit/apis/convex/api'
import { getFunctionName } from 'convex/server'
import { nodeRuntimeResolveRequestDtoSchema } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { QueryClient } from '@tanstack/react-query'
import { createAuthoredFormRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import type { AuthoredFormDomain } from '#forms/factories/authoredFormFactories.types'
import { resolveFixtureNodeRuntime } from './nodeRuntimeResolver'
import {
  authoredRouteStorySystem,
  authoredRouteStorySystems,
  createEditLoaderData,
  type AuthoredRouteStoryRecordMap,
  type AuthoredRouteStoryEditState
} from '#domains/authoredRouteStory.fixtures'

export function configureAuthoredRouteStoryQueries(queryClient: QueryClient) {
  queryClient.setQueryDefaults(
    ['convexQuery', getFunctionName(api.authoring.nodeRuntime.resolve)],
    {
      queryFn: async ({ queryKey }) =>
        resolveFixtureNodeRuntime(nodeRuntimeResolveRequestDtoSchema.parse(queryKey[2]))
    }
  )
}

export function createAuthoredCreateRouteOverrides(routeId: string, publicPath: string) {
  const loader = async () =>
    createAuthoredFormRouteLoaderData({
      system: authoredRouteStorySystem,
      systems: authoredRouteStorySystems
    })

  return {
    [routeId]: { loader },
    [publicPath]: { loader }
  }
}

export function createAuthoredEditRouteOverrides<TDomain extends AuthoredFormDomain>(
  domain: TDomain,
  routeId: string,
  publicPath: string,
  state: AuthoredRouteStoryEditState = 'ownedActive',
  recordOverride?: AuthoredRouteStoryRecordMap[TDomain]
) {
  const loader = async () => createEditLoaderData(domain, state, recordOverride)

  return {
    [routeId]: { loader },
    [publicPath]: { loader }
  }
}
