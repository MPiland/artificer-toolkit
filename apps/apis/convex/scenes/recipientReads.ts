import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneCurrentEntityPageInputSchema,
  sceneCurrentEntityPageSchema,
  sceneRecipientCaptureInputSchema,
  sceneRecipientCaptureSchema,
  sceneRecipientHeaderInputSchema,
  sceneRecipientHeaderSchema,
  type SceneRecipientCapture
} from '@artificer-toolkit/schema/api/sceneRecipient'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  assembleCurrentScene,
  readAllCurrentEntityPages,
  sceneCurrentCollections
} from '@artificer-toolkit/encounter-persistence/sceneCurrentEntities'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { isSceneEntityVisibleToViewer } from '@artificer-toolkit/shared/vtt'
import type { QueryCtx } from '../_generated/server'
import { internalQuery, query } from '../lib/queries'
import type { readLiveScene } from './liveDocuments'
import { readCurrentEntities, readCurrentEntitiesFromScene } from './currentEntities'
import { readRecipientContext } from './recipientContext'

const compactSceneEntityLimit = 16

/** A small Scene read in one transaction, filtered to what `viewer` may see. */
export async function readCompactScene(
  ctx: QueryCtx,
  captured: Pick<SceneRecipientCapture, 'header' | 'viewer'>,
  liveScene: Pick<Awaited<ReturnType<typeof readLiveScene>>, 'header' | 'live'>
): Promise<CampaignSceneStateDto | null> {
  const { header, viewer } = captured
  const totalEntities = sceneCurrentCollections.reduce(
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
  const pages = await readAllCurrentEntityPages(header, (input) =>
    readCurrentEntitiesFromScene(ctx, input, liveScene, prefetched)
  )
  // The compact path runs only without stored fog layers, so an empty list is exact.
  return assembleCurrentScene(header, pages, [], ({ value }) =>
    isSceneEntityVisibleToViewer(
      { map: header.map, fogMode: header.fogMode, fogLayers: [] },
      viewer,
      value
    )
  ).scene
}
export const header = query({
  args: zodToConvexFields(sceneRecipientHeaderInputSchema.shape),
  get returns() {
    return zodToConvex(sceneRecipientHeaderSchema)
  },
  handler: async (ctx, args) => {
    const input = sceneRecipientHeaderInputSchema.parse(args)
    const { capture, scene } = await readRecipientContext(
      ctx,
      input.sceneId,
      undefined,
      undefined,
      'VIEWER'
    )
    const recipientRevision = checksumCanonicalJson(capture)
    // A Scene shown as an image never carries its entities, even compact ones (D87).
    const snapshot =
      input.includeSnapshot === false || scene.reveal === 'SHOWN'
        ? null
        : ((await readCompactScene(ctx, capture, scene)) ?? null)
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
