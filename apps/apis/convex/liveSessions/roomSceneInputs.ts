import type { PaginationResult } from 'convex/server'
import type {
  LiveRoomInputsDocument,
  LiveRoomInputsResponse,
  LiveRoomInputsScope,
  LiveRoomSceneInputsCursor
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import { MAX_ROOM_INPUT_PAGE_DOCUMENTS } from '@artificer-toolkit/schema/api/liveRoomInputsBatch'
import {
  liveSessionCheckpointSceneSchemas,
  type LiveSessionCheckpointSceneTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { CampaignInternalScope } from '../campaigns/authority'
import { readLiveSceneForUser } from '../scenes/liveDocuments'

type StoredRow = Record<string, unknown> & { _id: string; _creationTime: number }
const PAGE = {
  numItems: MAX_ROOM_INPUT_PAGE_DOCUMENTS,
  maximumRowsRead: MAX_ROOM_INPUT_PAGE_DOCUMENTS + 1,
  maximumBytesRead: 4 * 1024 * 1024
}
const TABLES = [
  'sceneLiveStates',
  'sceneLiveEntities',
  'sceneLiveCommands',
  'sceneFogLayers',
  'sceneFogSaves',
  'sceneGeometrySaves'
] as const

function assertAdvances(page: PaginationResult<unknown>, cursor: string | null) {
  if (!page.isDone && page.continueCursor === cursor)
    throw new Error('Room input page cannot advance.')
}

function toDocument(
  table: LiveSessionCheckpointSceneTable,
  { _id, _creationTime, ...fields }: StoredRow,
  sceneId: string
): LiveRoomInputsDocument {
  const value = liveSessionCheckpointSceneSchemas[table].parse(fields)
  if ('sceneId' in value && value.sceneId !== sceneId)
    throw new Error('Room input record belongs to another Scene.')
  if ('status' in value) {
    if (
      value.status !== 'PUBLISHED' ||
      value.input.sceneId !== sceneId ||
      value.input.commandId !== value.commandId ||
      checksumCanonicalJson(value.input) !== value.inputChecksum
    )
      throw new Error('Stored Scene save is inconsistent.')
    if (
      'receivedChunks' in value &&
      (value.chunksRemoved || value.receivedChunks !== value.input.chunkManifest.length)
    )
      throw new Error('Stored Scene fog save is inconsistent.')
  }
  return { table, id: _id, creationTime: _creationTime, fields }
}

async function readRoomSceneAuthority(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  requestedSceneId: string,
  authorityScope: CampaignInternalScope
) {
  const sceneId = requestedSceneId.toLowerCase()
  const presentation = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .unique()
  if (presentation?.sceneId !== sceneId) throw new Error('Room Scene is not presented.')
  const { header, campaign: sceneCampaign } = await readLiveSceneForUser(
    ctx,
    sceneId,
    'OWNER',
    campaign.ownerUserId,
    authorityScope
  )
  if (sceneCampaign.id !== campaign.id) throw new Error('Room Scene belongs to another Campaign.')
  const source = {
    sceneId,
    definitionSaveId: header.definitionSaveId,
    definitionVersion: header.definitionVersion,
    presentationVersion: presentation.version
  }
  return { sceneId, header, source }
}

/** Immutable native definition rows, pinned to the presented live Scene's original save. */
export async function readRoomSceneDefinitionPage(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  scope: Extract<LiveRoomInputsScope, { kind: 'SCENE_DEFINITION' }>,
  authorityScope: CampaignInternalScope
): Promise<Extract<LiveRoomInputsResponse, { kind: 'SCENE_DEFINITION' }>> {
  const { header, source } = await readRoomSceneAuthority(
    ctx,
    campaign,
    scope.sceneId,
    authorityScope
  )
  if ((scope.cursor?.position ?? 0) !== 0) throw new Error('Room input cursor is invalid.')
  const cursor = scope.cursor?.paginationCursor ?? null
  const page = await ctx.db
    .query('sceneDefinitionEntities')
    .withIndex('by_saveId_collection_ordinal', (q) => q.eq('saveId', header.definitionSaveId))
    .paginate({ ...PAGE, cursor })
  if (page.pageStatus === 'SplitRequired') throw new Error('Room Scene definition page must split.')
  assertAdvances(page, cursor)
  return {
    kind: 'SCENE_DEFINITION',
    source,
    header,
    entities: page.page.map(({ _id, _creationTime, ...fields }) => {
      const entity = sceneStoredDefinitionEntitySchema.parse(fields)
      if (
        entity.saveId !== header.definitionSaveId ||
        entity.entityId !== entity.value.entity.id ||
        entity.ordinal >= header.counts[entity.value.collection] ||
        entity.checksum !== checksumCanonicalJson(entity.value)
      )
        throw new Error('Stored live Scene entity is inconsistent.')
      return entity
    }),
    continueCursor: page.isDone ? null : { position: 0, paginationCursor: page.continueCursor }
  }
}

/** Indexed native Scene families, without composed tokens or derived Character vision. */
export async function readRoomSceneInputsPage(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  scope: Extract<LiveRoomInputsScope, { kind: 'SCENE' }>,
  authorityScope: CampaignInternalScope
): Promise<Extract<LiveRoomInputsResponse, { kind: 'SCENE' }>> {
  const { sceneId, header, source } = await readRoomSceneAuthority(
    ctx,
    campaign,
    scope.sceneId,
    authorityScope
  )
  const position = scope.cursor?.position ?? 0
  const cursor = scope.cursor?.paginationCursor ?? null
  if (scope.cursor?.fogSave && position !== 6) throw new Error('Room input cursor is invalid.')

  if (position === 6) {
    const fogSave = scope.cursor?.fogSave
    if (!fogSave) {
      // Selecting a save and reading its chunks are separate pages: one native paginate per query.
      const saves = await ctx.db
        .query('sceneFogSaves')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', sceneId))
        .paginate({ ...PAGE, numItems: 1, cursor })
      assertAdvances(saves, cursor)
      const save = saves.page[0]?.status === 'PUBLISHED' ? saves.page[0] : undefined
      if (save) toDocument('sceneFogSaves', save, sceneId)
      return {
        kind: 'SCENE',
        source,
        sceneVersion: header.version,
        documents: [],
        continueCursor: save
          ? {
              position,
              paginationCursor: null,
              fogSave: { id: save.id, nextCursor: saves.continueCursor, isLast: saves.isDone }
            }
          : saves.isDone
            ? null
            : { position, paginationCursor: saves.continueCursor, fogSave: null }
      }
    }
    const save = await ctx.db
      .query('sceneFogSaves')
      .withIndex('by_publicId', (q) => q.eq('id', fogSave.id))
      .unique()
    if (!save || save.sceneId !== sceneId) throw new Error('Room Scene fog save is unavailable.')
    toDocument('sceneFogSaves', save, sceneId)
    const chunks = await ctx.db
      .query('sceneFogChunks')
      .withIndex('by_saveId_ordinal', (q) => q.eq('saveId', save.id))
      .paginate({ ...PAGE, cursor })
    assertAdvances(chunks, cursor)
    return {
      kind: 'SCENE',
      source,
      sceneVersion: header.version,
      documents: chunks.page.map((chunk) => {
        if (chunk.saveId !== save.id) throw new Error('Room fog chunk belongs to another save.')
        return toDocument('sceneFogChunks', chunk, sceneId)
      }),
      continueCursor: !chunks.isDone
        ? { position, paginationCursor: chunks.continueCursor, fogSave }
        : fogSave.isLast
          ? null
          : { position, paginationCursor: fogSave.nextCursor, fogSave: null }
    }
  }

  const queries = [
    () => ctx.db.query('sceneLiveStates').withIndex('by_sceneId', (q) => q.eq('sceneId', sceneId)),
    () =>
      ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_entityId', (q) => q.eq('sceneId', sceneId)),
    () =>
      ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', sceneId)),
    () =>
      ctx.db
        .query('sceneFogLayers')
        .withIndex('by_sceneId_ordinal', (q) => q.eq('sceneId', sceneId)),
    () =>
      ctx.db
        .query('sceneFogSaves')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', sceneId)),
    () =>
      ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', sceneId))
  ] as const
  const table = TABLES[position]
  const query = queries[position]
  if (!table || !query) throw new Error('Room input cursor is invalid.')
  const page = await query().paginate({ ...PAGE, cursor })
  assertAdvances(page, cursor)
  const continueCursor: LiveRoomSceneInputsCursor = !page.isDone
    ? { position, paginationCursor: page.continueCursor, fogSave: null }
    : { position: position + 1, paginationCursor: null, fogSave: null }
  return {
    kind: 'SCENE',
    source,
    sceneVersion: header.version,
    documents: page.page
      .filter((row) => !('status' in row) || row.status === 'PUBLISHED')
      .map((row) => toDocument(table, row, sceneId)),
    continueCursor
  }
}
