import { HttpResponse, http } from 'msw'
import type { NodeRuntimeResolveRequestDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { createAuthoredFormRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import { createStaticResolvedFormModel } from '#forms/node-map/staticResolvedModel'
import type { AuthoredFormDomain } from '#forms/factories/authoredFormFactories.types'
import {
  authoredRouteStorySystem,
  authoredRouteStorySystems,
  createEditLoaderData,
  type AuthoredRouteStoryEditState
} from './authoredRouteStory.fixtures'

export const authoredRouteNodeRuntimeHandlers = [
  http.post('*/api/trpc/nodeRuntime.resolve*', async ({ request }) => {
    const inputs = readBatchedInputs<NodeRuntimeResolveRequestDto>(await request.json())

    return trpcBatchJson(
      inputs.map(
        (input) =>
          createStaticResolvedFormModel(input.mapId, {
            ancestors: input.ancestors,
            parentValues: input.parentValues,
            system: authoredRouteStorySystem,
            values: input.values
          }) ?? {
            mapId: input.mapId,
            steps: [],
            clearPaths: []
          }
      )
    )
  })
]

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

export function createAuthoredEditRouteOverrides(
  domain: AuthoredFormDomain,
  routeId: string,
  publicPath: string,
  state: AuthoredRouteStoryEditState = 'ownedActive'
) {
  const loader = async () => createEditLoaderData(domain, state)

  return {
    [routeId]: { loader },
    [publicPath]: { loader }
  }
}

function trpcBatchJson(data: readonly unknown[]) {
  return HttpResponse.json(data.map((item) => ({ result: { data: item } })))
}

function readBatchedInputs<TInput>(body: unknown): TInput[] {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return Object.entries(body as Record<string, TInput>)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, input]) => input)
}
