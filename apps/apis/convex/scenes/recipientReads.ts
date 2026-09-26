import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneCurrentEntityPageInputSchema,
  sceneCurrentEntityPageSchema,
  sceneRecipientCaptureInputSchema,
  sceneRecipientCaptureSchema,
  sceneRecipientHeaderInputSchema,
  sceneRecipientHeaderSchema,
  type SceneCurrentEntityPage,
  type SceneRecipientCapture
} from '@artificer-toolkit/schema/api/sceneRecipient'
import {
  campaignSceneStateDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { SceneBaseOrdinals } from '@artificer-toolkit/schema/api/sceneGeometry'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { isSceneEntityVisibleToViewer } from '@artificer-toolkit/shared/vtt'
import { internalQuery, query, type QueryCtx } from '../_generated/server'
import type { readLiveScene } from './liveDocuments'
import { readCurrentEntities, readCurrentEntitiesFromScene } from './currentEntities'
import { readRecipientContext } from './recipientContext'

const compactCollections = [
  'annotations',
  'barriers',
  'darknessZones',
  'lights',
  'tokens',
  'measurements'
] as const
const compactSceneEntityLimit = 16

/**
 * A small Scene read in one transaction. A `null` viewer reads every entity for the room's shared
 * Scene cache, with each token's and barrier's definition ordinal.
 */
export async function readCompactScene(
  ctx: QueryCtx,
  captured: Pick<SceneRecipientCapture, 'header'> & {
    viewer: SceneRecipientCapture['viewer'] | null
  },
  liveScene: Pick<Awaited<ReturnType<typeof readLiveScene>>, 'header' | 'live'>
): Promise<{ scene: CampaignSceneStateDto; baseOrdinals: SceneBaseOrdinals } | null> {
  const { header, viewer } = captured
  const totalEntities = compactCollections.reduce(
    (total, collection) => total + header.currentCounts[collection],
    0
  )
  const totalBaseEntities = Object.values(header.counts).reduce((total, count) => total + count, 0)
  if (
    header.fogLayerCount !== 0 ||
    totalEntities > compactSceneEntityLimit ||
    totalBaseEntities > compactSceneEntityLimit
  )
    return null

  const [definitionEntities, liveEntities] = await Promise.all([
    ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId', (q) => q.eq('saveId', header.definitionSaveId))
      .take(compactSceneEntityLimit + 1),
    ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) => q.eq('sceneId', header.id))
      .take(compactSceneEntityLimit + 1)
  ])
  if (
    definitionEntities.length > compactSceneEntityLimit ||
    liveEntities.length > compactSceneEntityLimit
  )
    return null
  const prefetched = { definitionEntities, liveEntities }
  const entityPages = new Map(
    await Promise.all(
      compactCollections.map(async (collection) => {
        const page: SceneCurrentEntityPage['page'] = []
        let next: SceneCurrentEntityPage['next'] = { phase: 'BASE', afterOrdinal: null }
        while (next) {
          const current = await readCurrentEntitiesFromScene(
            ctx,
            {
              sceneId: header.id,
              expectedVersion: header.version,
              definitionSaveId: header.definitionSaveId,
              collection,
              numItems: 8,
              ...next
            },
            liveScene,
            prefetched
          )
          if (current.version !== header.version || current.collection !== collection)
            throw new Error('Compact Scene recipient page is inconsistent.')
          page.push(...current.page)
          if (page.length > header.currentCounts[collection])
            throw new Error('Compact Scene recipient count is inconsistent.')
          next = current.next
        }
        if (
          page.length !== header.currentCounts[collection] ||
          new Set(page.map(({ value }) => value.entity.id)).size !== page.length
        )
          throw new Error('Compact Scene recipient entities are inconsistent.')
        return [
          collection,
          viewer === null
            ? page
            : page.filter(({ value }) =>
                // The compact path runs only without stored fog layers, so an empty list is exact.
                isSceneEntityVisibleToViewer(
                  { map: header.map, fogMode: header.fogMode, fogLayers: [] },
                  viewer,
                  value
                )
              )
        ] as const
      })
    )
  )

  const barriers = entityPages.get('barriers')!
  const doorStates: CampaignSceneStateDto['doorStates'] = {}
  for (const row of barriers) {
    if (row.value.collection === 'barriers' && row.value.entity.kind === 'DOOR') {
      if (row.doorState === null) throw new Error('Compact Scene door state is inconsistent.')
      doorStates[row.value.entity.id] = row.doorState
    }
  }
  const {
    definitionSaveId: _definitionSaveId,
    counts: _counts,
    currentCounts: _currentCounts,
    fogLayerCount: _fogLayerCount,
    ...scene
  } = header
  const tokens = entityPages.get('tokens')!
  const baseOrdinal = (collection: 'tokens' | 'barriers', ordinal: number) =>
    ordinal < header.counts[collection] ? ordinal : null
  return {
    scene: campaignSceneStateDtoSchema.parse({
      ...scene,
      annotations: entityPages.get('annotations')!.map((row) => row.value.entity),
      barriers: barriers.map((row) => row.value.entity),
      darknessZones: entityPages.get('darknessZones')!.map((row) => row.value.entity),
      lights: entityPages.get('lights')!.map((row) => row.value.entity),
      tokens: tokens.map((row) => row.value.entity),
      measurements: entityPages.get('measurements')!.map((row) => row.value.entity),
      doorStates,
      fogLayers: []
    }),
    baseOrdinals: {
      tokens: tokens.map((row) => ({
        tokenId: row.value.entity.id,
        baseOrdinal: baseOrdinal('tokens', row.ordinal)
      })),
      barriers: barriers.map((row) => ({
        barrierId: row.value.entity.id,
        baseOrdinal: baseOrdinal('barriers', row.ordinal)
      }))
    }
  }
}
export const header = query({
  args: zodToConvexFields(sceneRecipientHeaderInputSchema.shape),
  get returns() {
    return zodToConvex(sceneRecipientHeaderSchema)
  },
  handler: async (ctx, args) => {
    const input = sceneRecipientHeaderInputSchema.parse(args)
    const { capture, scene } = await readRecipientContext(ctx, input.sceneId)
    const recipientRevision = checksumCanonicalJson(capture)
    const snapshot =
      input.includeSnapshot === false
        ? null
        : ((await readCompactScene(ctx, capture, scene))?.scene ?? null)
    const {
      definitionSaveId: _save,
      counts: _base,
      currentCounts: _current,
      fogLayerCount: _fog,
      ...publicHeader
    } = capture.header
    return sceneRecipientHeaderSchema.parse({
      ...publicHeader,
      recipientRevision,
      snapshot
    })
  }
})

export const capture = internalQuery({
  args: zodToConvexFields(sceneRecipientCaptureInputSchema.shape),
  get returns() {
    return zodToConvex(sceneRecipientCaptureSchema)
  },
  handler: async (ctx, args) => {
    const input = sceneRecipientCaptureInputSchema.parse(args)
    return (await readRecipientContext(ctx, input.sceneId, input.expectedVersion)).capture
  }
})

export const currentEntities = internalQuery({
  args: zodToConvexFields(sceneCurrentEntityPageInputSchema.shape),
  get returns() {
    return zodToConvex(sceneCurrentEntityPageSchema)
  },
  handler: async (ctx, args) =>
    readCurrentEntities(ctx, sceneCurrentEntityPageInputSchema.parse(args), 'MEMBER')
})
