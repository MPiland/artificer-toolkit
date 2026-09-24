import type {
  SceneFogChunksPage,
  SceneFogChunksPageInput,
  SceneFogLayersPage,
  SceneFogLayersPageInput
} from '@artificer-toolkit/schema/api/sceneFog'
import {
  sceneFogChunksPageSchema,
  sceneFogLayersPageSchema
} from '@artificer-toolkit/schema/api/sceneFog'
import type { QueryCtx } from '../_generated/server'
import { parseFogLayer, readFogChunk } from './fogDocuments'
import { readLiveScene } from './liveDocuments'

type FogReadAudience = 'RECIPIENT' | 'TRANSIENT_HOST'

export async function readFogLayers(
  ctx: QueryCtx,
  input: SceneFogLayersPageInput,
  audience: FogReadAudience
): Promise<SceneFogLayersPage> {
  const { header, membership, userId } = await readLiveScene(ctx, input.sceneId, 'MEMBER')
  if (
    (input.paginationOpts.cursor !== null && input.expectedVersion === null) ||
    (input.expectedVersion !== null && input.expectedVersion !== header.version)
  )
    throw new Error('Live Scene snapshot changed before fog hydration.')
  let rows = ctx.db
    .query('sceneFogLayers')
    .withIndex('by_sceneId_ownerUserId', (q) => q.eq('sceneId', header.id))
  if (audience === 'RECIPIENT' && membership.role !== 'OWNER')
    rows = rows.filter((q) =>
      q.or(q.eq(q.field('ownerUserId'), null), q.eq(q.field('ownerUserId'), userId))
    )
  // A Scene has at most 101 bounded reference headers; recipient filtering may scan them all.
  const result = await rows.paginate(input.paginationOpts)
  return sceneFogLayersPageSchema.parse({
    ...result,
    version: header.version,
    page: result.page.map((row) => {
      const layer = parseFogLayer(row, header.version)
      return {
        ownerUserId: layer.ownerUserId,
        width: layer.width,
        height: layer.height,
        ordinal: layer.ordinal,
        chunkCount: layer.chunks.length
      }
    })
  })
}

export async function readFogChunks(
  ctx: QueryCtx,
  input: SceneFogChunksPageInput,
  audience: FogReadAudience
): Promise<SceneFogChunksPage> {
  const { header, membership, userId } = await readLiveScene(ctx, input.sceneId, 'MEMBER')
  if (
    audience === 'RECIPIENT' &&
    membership.role !== 'OWNER' &&
    input.ownerUserId !== null &&
    input.ownerUserId !== userId
  )
    throw new Error('Scene fog layer is unavailable.')
  if (input.expectedVersion !== header.version)
    throw new Error('Live Scene snapshot changed before fog hydration.')
  const row = await ctx.db
    .query('sceneFogLayers')
    .withIndex('by_sceneId_ownerUserId', (q) =>
      q.eq('sceneId', header.id).eq('ownerUserId', input.ownerUserId)
    )
    .unique()
  if (!row) throw new Error('Scene fog layer is unavailable.')
  const layer = parseFogLayer(row, header.version)
  if (input.offset > layer.chunks.length) throw new Error('Fog page offset is beyond the layer.')
  const selected = layer.chunks.slice(input.offset, input.offset + input.numItems)
  const page = await Promise.all(
    selected.map((reference) => readFogChunk(ctx, reference, header.id, layer))
  )
  const nextOffset = input.offset + selected.length
  return sceneFogChunksPageSchema.parse({
    version: header.version,
    ownerUserId: layer.ownerUserId,
    width: layer.width,
    height: layer.height,
    page,
    nextOffset,
    isDone: nextOffset === layer.chunks.length
  })
}
