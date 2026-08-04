import { HttpResponse, http } from 'msw'
import type { NodeRuntimeResolveRequestDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { createAuthoredFormRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import { createStaticResolvedFormModel } from '#forms/node-map/staticResolvedModel'
import type { AuthoredFormDomain } from '#forms/factories/authoredFormFactories.types'
import {
  authoredRouteStoryRecords,
  authoredRouteStorySystem,
  authoredRouteStorySystems,
  createEditLoaderData,
  type AuthoredRouteStoryRecordMap,
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
  }),
  createCopySourceHandler('backgrounds', authoredRouteStoryRecords.background),
  createCopySourceHandler('classes', authoredRouteStoryRecords.class),
  createCopySourceHandler('creatures', authoredRouteStoryRecords.creature),
  createCopySourceHandler('equipment', authoredRouteStoryRecords.equipment),
  createCopySourceHandler('feats', authoredRouteStoryRecords.feat),
  createCopySourceHandler('races', authoredRouteStoryRecords.race),
  createCopySourceHandler('spells', authoredRouteStoryRecords.spell),
  createCopySourceHandler('vehicles', authoredRouteStoryRecords.vehicle)
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

function trpcBatchJson(data: readonly unknown[]) {
  return HttpResponse.json(data.map((item) => ({ result: { data: item } })))
}

function createCopySourceHandler(
  endpoint: string,
  record: { description?: string | null; id: string; label: string }
) {
  return http.get(`*/api/trpc/content.${endpoint}.list`, () =>
    trpcBatchJson([
      {
        drafts: [],
        items: [
          {
            ...record,
            activeRevisionId: `${record.id}-active-revision`,
            description: record.description,
            id: record.id,
            label: record.label,
            permissions: {
              canCopy: true,
              canDelete: false,
              canEdit: false,
              canView: true
            },
            provenance: { kind: 'MASTER', ownerUserId: null },
            publicId: record.id,
            status: 'ACTIVE'
          }
        ],
        meta: {}
      }
    ])
  )
}

function readBatchedInputs<TInput>(body: unknown): TInput[] {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return Object.entries(body as Record<string, TInput>)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, input]) => input)
}
