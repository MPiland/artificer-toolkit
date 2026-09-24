import { queryOptions } from '@tanstack/react-query'
import type { ConvexReactClient } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  SCENE_DEFINITION_BATCH_SIZE,
  appendSceneDefinitionInputSchema,
  campaignLiveSceneListPageSchema,
  sceneDefinitionHeaderSchema,
  sceneDefinitionEntityPageSchema,
  sceneDefinitionSaveProgressSchema,
  type SceneDefinitionEntity
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import {
  createSceneDefinitionInputDtoSchema,
  getSceneDefinitionInputDtoSchema,
  sceneDefinitionDtoSchema,
  updateSceneDefinitionInputDtoSchema,
  type CreateSceneDefinitionInputDto,
  type GetSceneDefinitionInputDto,
  type UpdateSceneDefinitionInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import { queryKeys } from '#app/lib/queryKeys'

const collections = ['annotations', 'barriers', 'darknessZones', 'lights', 'tokens'] as const
type SceneDefinitionCollection = (typeof collections)[number]

function aborted(signal?: AbortSignal) {
  signal?.throwIfAborted()
}

export function getCampaignLiveScenes(campaignId: string, client: ConvexReactClient) {
  return queryOptions({
    queryKey: queryKeys.campaigns.liveScenes(campaignId),
    queryFn: async ({ signal }) => {
      const scenes = []
      let cursor: string | null = null
      const seen = new Set<string | null>()
      for (;;) {
        aborted(signal)
        if (seen.has(cursor)) throw new Error('Campaign live Scene pagination did not advance.')
        seen.add(cursor)
        const page = campaignLiveSceneListPageSchema.parse(
          await client.query(api.scenes.definitionReads.listLive, {
            campaignId,
            paginationOpts: { cursor, numItems: SCENE_DEFINITION_BATCH_SIZE }
          })
        )
        aborted(signal)
        scenes.push(...page.page)
        if (page.isDone) return scenes
        if (page.continueCursor === cursor)
          throw new Error('Campaign live Scene pagination did not advance.')
        cursor = page.continueCursor
      }
    }
  })
}

async function readCollection(
  client: ConvexReactClient,
  input: GetSceneDefinitionInputDto,
  saveId: string,
  collection: SceneDefinitionCollection,
  signal?: AbortSignal
) {
  const entities: SceneDefinitionEntity['entity'][] = []
  let cursor: string | null = null
  const seen = new Set<string | null>()
  for (;;) {
    aborted(signal)
    if (seen.has(cursor)) throw new Error('Scene definition pagination did not advance.')
    seen.add(cursor)
    const page = sceneDefinitionEntityPageSchema.parse(
      await client.query(api.scenes.definitionReads.entities, {
        campaignId: input.campaignId,
        sceneId: input.sceneId,
        saveId,
        collection,
        paginationOpts: { cursor, numItems: SCENE_DEFINITION_BATCH_SIZE }
      })
    )
    aborted(signal)
    for (const row of page.page) {
      if (row.value.collection !== collection || row.ordinal !== entities.length)
        throw new Error('Scene definition entity page is inconsistent.')
      entities.push(row.value.entity)
    }
    if (page.isDone) return entities
    if (page.continueCursor === cursor)
      throw new Error('Scene definition pagination did not advance.')
    cursor = page.continueCursor
  }
}

export async function loadSceneDefinition(
  client: ConvexReactClient,
  rawInput: GetSceneDefinitionInputDto,
  signal?: AbortSignal
): Promise<SceneDefinitionDto> {
  const input = getSceneDefinitionInputDtoSchema.parse(rawInput)
  aborted(signal)
  const header = sceneDefinitionHeaderSchema.parse(
    await client.query(api.scenes.definitionReads.get, input)
  )
  if (
    header.id !== input.sceneId.toLowerCase() ||
    header.campaignId !== input.campaignId.toLowerCase()
  )
    throw new Error('Scene definition identity is inconsistent.')
  aborted(signal)
  const values = await Promise.all(
    collections.map((collection) =>
      readCollection(client, input, header.saveId, collection, signal)
    )
  )
  const entries = collections.map((collection, index) => {
    const entities = values[index]!
    if (entities.length !== header.counts[collection])
      throw new Error('Scene definition entity count is inconsistent.')
    return [collection, entities]
  })
  const {
    saveId: _saveId,
    counts: _counts,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...scene
  } = header
  return sceneDefinitionDtoSchema.parse({ ...scene, ...Object.fromEntries(entries) })
}

export async function saveSceneDefinition(
  client: ConvexReactClient,
  rawInput: CreateSceneDefinitionInputDto | UpdateSceneDefinitionInputDto,
  commandId: string
): Promise<SceneDefinitionDto> {
  const { sceneId, expectedVersion, ...definition } =
    'sceneId' in rawInput
      ? updateSceneDefinitionInputDtoSchema.parse(rawInput)
      : {
          ...createSceneDefinitionInputDtoSchema.parse(rawInput),
          sceneId: null,
          expectedVersion: null
        }
  const { annotations, barriers, darknessZones, lights, tokens, ...rawSettings } = definition
  const settings = {
    ...rawSettings,
    campaignId: rawSettings.campaignId.toLowerCase(),
    map: { ...rawSettings.map, assetId: rawSettings.map.assetId.toLowerCase() }
  }
  let progress = sceneDefinitionSaveProgressSchema.parse(
    await client.mutation(api.scenes.definitions.begin, {
      commandId,
      sceneId,
      expectedVersion,
      settings,
      counts: {
        annotations: annotations.length,
        barriers: barriers.length,
        darknessZones: darknessZones.length,
        lights: lights.length,
        tokens: tokens.length
      }
    })
  )
  if (progress.status === 'EXPIRED') throw new Error('Scene definition save expired.')
  if (progress.status !== 'PUBLISHED') {
    const source = { annotations, barriers, darknessZones, lights, tokens }
    for (const collection of collections) {
      for (
        let offset = progress.received[collection];
        offset < source[collection].length;
        offset += SCENE_DEFINITION_BATCH_SIZE
      ) {
        await client.mutation(api.scenes.definitions.append, {
          input: appendSceneDefinitionInputSchema.parse({
            saveId: progress.saveId,
            collection,
            offset,
            entities: source[collection].slice(offset, offset + SCENE_DEFINITION_BATCH_SIZE)
          })
        })
      }
    }
    progress = sceneDefinitionSaveProgressSchema.parse(
      await client.mutation(api.scenes.definitions.publish, { saveId: progress.saveId })
    )
  }
  if (progress.status !== 'PUBLISHED')
    throw new Error('Scene definition publication did not finish.')
  return sceneDefinitionDtoSchema.parse({
    ...settings,
    id: progress.sceneId,
    version: progress.version,
    annotations,
    barriers,
    darknessZones,
    lights,
    tokens
  })
}
