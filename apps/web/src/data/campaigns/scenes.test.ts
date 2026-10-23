import { QueryClient } from '@tanstack/react-query'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { CampaignLiveSceneSummaryDto } from '@artificer-toolkit/schema/api/vttScenes'
import { sceneDefinitionDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import {
  beginSceneDefinitionInputSchema,
  sceneDefinitionEntityPageInputSchema,
  sceneDefinitionHeaderSchema,
  sceneDefinitionListInputSchema
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import { getCampaignLiveScenes, loadSceneDefinition, saveSceneDefinition } from './scenes'

const campaignId = '00000000-0000-4000-8000-000000000001'
const sceneId = '00000000-0000-4000-8000-000000000002'
const saveId = '00000000-0000-4000-8000-000000000003'
const mapId = '00000000-0000-4000-8000-000000000004'

const scene = sceneDefinitionDtoSchema.parse({
  id: sceneId,
  campaignId,
  name: 'Courtyard',
  version: 1,
  ambientIllumination: 'BRIGHT',
  daylight: false,
  fogMode: 'PER_PLAYER',
  visionRevealMode: 'ON_DRAG',
  grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
  map: { assetId: mapId, width: 64, height: 64, tileManifestAssetId: null },
  annotations: Array.from({ length: 9 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${(100 + index).toString().padStart(12, '0')}`,
    position: { x: index, y: index },
    text: `Note ${index}`,
    visibility: 'GM_ONLY' as const
  })),
  barriers: [],
  darknessZones: [],
  lights: [],
  tokens: []
})
const { annotations, barriers, darknessZones, lights, tokens, ...settings } = scene
const header = sceneDefinitionHeaderSchema.parse({
  ...settings,
  saveId,
  counts: {
    annotations: annotations.length,
    barriers: barriers.length,
    darknessZones: darknessZones.length,
    lights: lights.length,
    tokens: tokens.length
  },
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z'
})
const progress = {
  saveId,
  sceneId,
  version: 2,
  status: 'RECEIVING' as const,
  counts: header.counts,
  received: { ...header.counts, annotations: 8 },
  liveSceneId: null
}
const liveScene = {
  id: '00000000-0000-4000-8000-000000000005',
  definitionId: sceneId,
  name: 'Courtyard',
  version: 1
} satisfies CampaignLiveSceneSummaryDto

afterEach(() => vi.restoreAllMocks())

function client() {
  return new ConvexReactClient('https://unit-test.convex.cloud', { logger: false })
}

it('loads every live Scene page, including an empty continuation page', async () => {
  const convex = client()
  const query = vi.spyOn(convex, 'query').mockImplementation(async (...[reference, args]) => {
    expect(getFunctionName(reference)).toBe(getFunctionName(api.scenes.definitionReads.listLive))
    const cursor = sceneDefinitionListInputSchema.parse(args).paginationOpts.cursor
    if (cursor === null) return { page: [], isDone: false, continueCursor: 'next' }
    return { page: [liveScene], isDone: true, continueCursor: '' }
  })
  const queryClient = new QueryClient()

  await expect(queryClient.fetchQuery(getCampaignLiveScenes(campaignId, convex))).resolves.toEqual([
    liveScene
  ])
  expect(query.mock.calls.map(([, input]) => input)).toEqual([
    { campaignId, paginationOpts: { cursor: null, numItems: 8 } },
    { campaignId, paginationOpts: { cursor: 'next', numItems: 8 } }
  ])
})

it('rejects a repeated live Scene cursor', async () => {
  const convex = client()
  const query = vi.spyOn(convex, 'query').mockImplementation(async (...[, args]) => {
    const cursor = sceneDefinitionListInputSchema.parse(args).paginationOpts.cursor
    return {
      page: [],
      isDone: false,
      continueCursor: cursor === null ? 'first' : cursor === 'first' ? 'second' : 'first'
    }
  })
  const queryClient = new QueryClient()

  await expect(queryClient.fetchQuery(getCampaignLiveScenes(campaignId, convex))).rejects.toThrow(
    'Campaign live Scene pagination did not advance.'
  )
  expect(query).toHaveBeenCalledTimes(3)
})

it('loads bounded continuation pages and reconstructs the exact Scene definition', async () => {
  const convex = client()
  const query = vi.spyOn(convex, 'query').mockImplementation(async (...[reference, args]) => {
    const name = getFunctionName(reference)
    if (name === getFunctionName(api.scenes.definitionReads.get)) return header
    const input = sceneDefinitionEntityPageInputSchema.parse(args)
    expect(input.saveId).toBe(saveId)
    expect(input.paginationOpts.numItems).toBe(8)
    const rows =
      input.collection === 'annotations'
        ? (input.paginationOpts.cursor === 'next'
            ? []
            : scene.annotations.slice(
                input.paginationOpts.cursor === null ? 0 : 8,
                input.paginationOpts.cursor === null ? 8 : undefined
              )
          ).map((entity, ordinal) => ({
            ordinal: ordinal + (input.paginationOpts.cursor === null ? 0 : 8),
            value: { collection: 'annotations' as const, entity }
          }))
        : []
    return {
      page: rows,
      isDone: input.collection !== 'annotations' || input.paginationOpts.cursor === 'end',
      continueCursor: input.paginationOpts.cursor === null ? 'next' : 'end'
    }
  })
  await expect(loadSceneDefinition(convex, { campaignId, sceneId })).resolves.toEqual(scene)
  expect(query).toHaveBeenCalledTimes(8)
})

it('resumes a bounded save and never publishes after an append failure', async () => {
  const convex = client()
  const commandId = crypto.randomUUID()
  let failAppend = true
  const mutation = vi.spyOn(convex, 'mutation').mockImplementation(async (...[reference, args]) => {
    const name = getFunctionName(reference)
    if (name === getFunctionName(api.scenes.definitions.begin)) {
      expect(beginSceneDefinitionInputSchema.parse(args)).toMatchObject({
        commandId,
        sceneId,
        expectedVersion: 1
      })
      return progress
    }
    if (name === getFunctionName(api.scenes.definitions.append)) {
      expect(args).toMatchObject({ input: { offset: 8, entities: [scene.annotations[8]] } })
      if (failAppend) throw new Error('append failed')
      return { ...progress, received: header.counts }
    }
    return { ...progress, received: header.counts, status: 'PUBLISHED' as const }
  })
  const { id, version, ...definition } = scene
  const input = { ...definition, sceneId: id, expectedVersion: version }
  await expect(saveSceneDefinition(convex, input, commandId)).rejects.toThrow('append failed')
  expect(
    mutation.mock.calls.some(
      ([reference]) =>
        getFunctionName(reference) === getFunctionName(api.scenes.definitions.publish)
    )
  ).toBe(false)
  failAppend = false
  await expect(saveSceneDefinition(convex, input, commandId)).resolves.toEqual({
    ...scene,
    version: 2
  })
  expect(
    mutation.mock.calls.filter(
      ([reference]) =>
        getFunctionName(reference) === getFunctionName(api.scenes.definitions.publish)
    )
  ).toHaveLength(1)
})

it.each(['collection', 'ordinal', 'count', 'cursor'] as const)(
  'rejects inconsistent %s while hydrating',
  async (failure) => {
    const convex = client()
    vi.spyOn(convex, 'query').mockImplementation(async (...[reference, args]) => {
      if (getFunctionName(reference) === getFunctionName(api.scenes.definitionReads.get))
        return header
      const input = sceneDefinitionEntityPageInputSchema.parse(args)
      return {
        page:
          (input.collection === 'annotations' || failure === 'collection') &&
          failure !== 'count' &&
          failure !== 'cursor'
            ? [
                {
                  ordinal: failure === 'ordinal' ? 1 : 0,
                  value: { collection: 'annotations', entity: scene.annotations[0] }
                }
              ]
            : [],
        isDone: failure !== 'cursor' || input.collection !== 'annotations',
        continueCursor: 'same'
      }
    })
    await expect(loadSceneDefinition(convex, { campaignId, sceneId })).rejects.toThrow(
      failure === 'count'
        ? 'count is inconsistent'
        : failure === 'cursor'
          ? 'pagination did not advance'
          : 'page is inconsistent'
    )
  }
)

it('stops before querying when hydration is cancelled', async () => {
  const convex = client()
  const query = vi.spyOn(convex, 'query')
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  await expect(
    loadSceneDefinition(convex, { campaignId, sceneId }, controller.signal)
  ).rejects.toThrow('cancelled')
  expect(query).not.toHaveBeenCalled()
})

it('replays an already published save without further writes', async () => {
  const convex = client()
  const mutation = vi.spyOn(convex, 'mutation').mockResolvedValue({
    ...progress,
    status: 'PUBLISHED',
    received: header.counts
  })
  const { id, version, ...definition } = scene
  await expect(
    saveSceneDefinition(
      convex,
      { ...definition, sceneId: id, expectedVersion: version },
      crypto.randomUUID()
    )
  ).resolves.toEqual({ ...scene, version: 2 })
  expect(mutation).toHaveBeenCalledTimes(1)
})
