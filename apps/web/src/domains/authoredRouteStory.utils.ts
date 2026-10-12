import { api } from '@artificer-toolkit/apis/convex/api'
import { getFunctionName } from 'convex/server'
import {
  nodeRuntimeResolveRequestDtoSchema,
  type NodeRuntimeResolveRequestDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type { QueryClient } from '@tanstack/react-query'
import { createAuthoredFormRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import { createStaticResolvedFormModel } from '#forms/node-map/staticResolvedModel'
import type { AuthoredFormDomain } from '#forms/factories/authoredFormFactories.types'
import {
  authoredRouteStorySystem,
  authoredRouteStorySystems,
  createEditLoaderData,
  type AuthoredRouteStoryRecordMap,
  type AuthoredRouteStoryEditState
} from './authoredRouteStory.fixtures'

function resolveStoryNodes(input: NodeRuntimeResolveRequestDto) {
  return (
    createStaticResolvedFormModel(input.mapId, {
      ancestors: input.ancestors,
      parentValues: input.parentValues,
      system: authoredRouteStorySystem,
      values: input.values
    }) ?? { mapId: input.mapId, steps: [], clearPaths: [] }
  )
}

export function configureAuthoredRouteStoryQueries(queryClient: QueryClient) {
  queryClient.setQueryDefaults(
    ['convexQuery', getFunctionName(api.authoring.nodeRuntime.resolve)],
    {
      queryFn: async ({ queryKey }) =>
        resolveStoryNodes(nodeRuntimeResolveRequestDtoSchema.parse(queryKey[2]))
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
