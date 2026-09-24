import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneFogAppendInputSchema,
  sceneFogCommandResultSchema,
  sceneFogPatchInputSchema,
  sceneFogSaveLookupSchema,
  sceneFogSaveProgressSchema,
  type SceneFogAppendInput,
  type SceneFogPatchInput,
  type SceneFogSaveProgress
} from '@artificer-toolkit/schema/api/sceneFog'
import { sceneFogLayerDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneStoredFogChunkSchema,
  sceneStoredFogSaveSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { sceneStoredFogCommandSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { type MutationCtx } from '../_generated/server'
import { internalMutation, mutation } from '../lib/mutations'
import { advanceLiveState, readLiveScene } from './liveDocuments'
import { parseFogCommand, parseFogSave, readFogSave } from './fogDocuments'
import { publishFogLayer } from './fogPublication'
import { readPresentedVisionScene } from './sessionVisionDocuments'

const SAVE_WINDOW = 24 * 60 * 60_000
const cleanupReference = makeFunctionReference<'mutation', { saveId: string }, null>(
  'scenes/fogCommands:cleanup'
)

function progress(save: ReturnType<typeof sceneStoredFogSaveSchema.parse>): SceneFogSaveProgress {
  return sceneFogSaveProgressSchema.parse({
    saveId: save.id,
    sceneId: save.sceneId,
    commandId: save.commandId,
    status: save.status,
    receivedChunks: save.receivedChunks,
    totalChunks: save.input.chunkManifest.length
  })
}

function normalizeBegin(input: SceneFogPatchInput): SceneFogPatchInput {
  return {
    ...input,
    sceneId: input.sceneId.toLowerCase(),
    commandId: input.commandId.toLowerCase(),
    layer: {
      ...input.layer,
      ownerUserId: input.layer.ownerUserId?.toLowerCase() ?? null
    }
  }
}

function normalizeAppend(input: SceneFogAppendInput): SceneFogAppendInput {
  return { ...input, saveId: input.saveId.toLowerCase() }
}

function assertActive(campaign: { status: string }) {
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
}

async function assertFogPresentation(
  ctx: MutationCtx,
  campaignId: string,
  input: SceneFogPatchInput,
  replayed: boolean
): Promise<void> {
  if (!input.presentation) return
  const current = await readPresentedVisionScene(ctx, { campaignId, sceneId: input.sceneId })
  if (replayed) return
  if (current.presentation.version !== input.presentation.expectedPresentationVersion)
    throw new Error('Scene vision presentation is stale.')
}
async function exactBatchReplay(
  ctx: MutationCtx,
  save: ReturnType<typeof sceneStoredFogSaveSchema.parse>,
  input: SceneFogAppendInput
) {
  if (input.offset + input.chunks.length > save.receivedChunks) return false
  const rows = await ctx.db
    .query('sceneFogChunks')
    .withIndex('by_saveId_ordinal', (q) =>
      q
        .eq('saveId', save.id)
        .gte('ordinal', input.offset)
        .lt('ordinal', input.offset + input.chunks.length)
    )
    .take(9)
  return (
    rows.length === input.chunks.length &&
    rows.every((row, index) => {
      const chunk = sceneStoredFogChunkSchema.parse({
        saveId: row.saveId,
        ordinal: row.ordinal,
        chunk: row.chunk,
        checksum: row.checksum
      })
      const supplied = input.chunks[index]!
      return (
        chunk.ordinal === input.offset + index &&
        checksumCanonicalJson(chunk.chunk) === checksumCanonicalJson(supplied) &&
        chunk.checksum === checksumCanonicalJson(supplied)
      )
    })
  )
}

function validateAppend(
  save: ReturnType<typeof sceneStoredFogSaveSchema.parse>,
  input: SceneFogAppendInput
) {
  sceneFogLayerDtoSchema.parse({ ...save.input.layer, chunks: input.chunks })
  if (input.offset + input.chunks.length > save.input.chunkManifest.length)
    throw new Error('Scene fog chunk batch exceeds its manifest.')
  for (const [index, chunk] of input.chunks.entries()) {
    const manifest = save.input.chunkManifest[input.offset + index]
    const checksum = checksumCanonicalJson(chunk)
    if (!manifest || manifest.index !== chunk.index || manifest.checksum !== checksum)
      throw new Error('Scene fog chunk does not match its manifest.')
  }
}

export const begin = mutation({
  args: { input: zodToConvex(sceneFogPatchInputSchema) },
  returns: zodToConvex(sceneFogSaveProgressSchema),
  handler: async (ctx, args): Promise<SceneFogSaveProgress> => {
    const input = normalizeBegin(sceneFogPatchInputSchema.parse(args.input))
    const { header, campaign, userId } = await readLiveScene(ctx, input.sceneId, 'OWNER')
    assertActive(campaign)
    const inputChecksum = checksumCanonicalJson(input)
    const priorCommand = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', header.id).eq('commandId', input.commandId)
      )
      .unique()
    await assertFogPresentation(ctx, campaign.id, input, priorCommand !== null)
    if (priorCommand) {
      if (priorCommand.encoding !== 'FOG_PATCH')
        throw new Error('Scene command ID was already used.')
      const prior = parseFogCommand(priorCommand, header.version)
      if (prior.inputChecksum !== inputChecksum)
        throw new Error('Scene command ID was already used.')
      const row = await ctx.db
        .query('sceneFogSaves')
        .withIndex('by_publicId', (q) => q.eq('id', prior.result.patch.saveId))
        .unique()
      if (!row) throw new Error('Stored Scene fog save is inconsistent.')
      const save = parseFogSave(row)
      if (save.status !== 'PUBLISHED') throw new Error('Stored Scene fog save is inconsistent.')
      return progress(save)
    }
    const priorSave = await ctx.db
      .query('sceneFogSaves')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', header.id).eq('commandId', input.commandId)
      )
      .unique()
    if (priorSave) {
      const save = parseFogSave(priorSave)
      if (save.geometrySaveId)
        throw new Error('Derived Scene fog saves cannot be changed manually.')
      if (save.inputChecksum !== inputChecksum)
        throw new Error('Scene fog command was already used.')
      if (save.status === 'RECEIVING' && save.actorUserId !== userId)
        throw new Error('Scene fog save is unavailable.')
      if (
        save.status === 'EXPIRED' ||
        (save.status === 'RECEIVING' && save.expiresAt <= Date.now())
      )
        throw new Error('Scene fog save expired.')
      return progress(save)
    }
    const expiresAt = Date.now() + SAVE_WINDOW
    const save = sceneStoredFogSaveSchema.parse({
      id: crypto.randomUUID(),
      sceneId: header.id,
      commandId: input.commandId,
      actorUserId: userId,
      input,
      inputChecksum,
      status: 'RECEIVING',
      receivedChunks: 0,
      expiresAt,
      chunksRemoved: false
    })
    await ctx.db.insert('sceneFogSaves', save)
    await ctx.scheduler.runAt(expiresAt, cleanupReference, { saveId: save.id })
    return progress(save)
  }
})

export const append = mutation({
  args: { input: zodToConvex(sceneFogAppendInputSchema) },
  returns: zodToConvex(sceneFogSaveProgressSchema),
  handler: async (ctx, args): Promise<SceneFogSaveProgress> => {
    const input = normalizeAppend(sceneFogAppendInputSchema.parse(args.input))
    const { row, save, campaign, userId } = await readFogSave(ctx, input.saveId)
    if (save.geometrySaveId) throw new Error('Derived Scene fog saves cannot be changed manually.')
    assertActive(campaign)
    if (save.actorUserId !== userId) throw new Error('Scene fog save is unavailable.')
    await assertFogPresentation(ctx, campaign.id, save.input, save.status === 'PUBLISHED')
    validateAppend(save, input)
    const replay = await exactBatchReplay(ctx, save, input)
    if (save.status === 'PUBLISHED') {
      if (!replay) throw new Error('Published Scene fog batches cannot change.')
      return progress(save)
    }
    if (save.status !== 'RECEIVING' || save.chunksRemoved || save.expiresAt <= Date.now())
      throw new Error('Scene fog save expired.')
    if (input.offset < save.receivedChunks) {
      if (!replay) throw new Error('Scene fog batch replay does not match.')
      return progress(save)
    }
    if (input.offset !== save.receivedChunks)
      throw new Error('Scene fog chunk batch offset is invalid.')
    const chunks = input.chunks.map((chunk, index) =>
      sceneStoredFogChunkSchema.parse({
        saveId: save.id,
        ordinal: input.offset + index,
        chunk,
        checksum: checksumCanonicalJson(chunk)
      })
    )
    for (const chunk of chunks) await ctx.db.insert('sceneFogChunks', chunk)
    const receivedChunks = save.receivedChunks + chunks.length
    await ctx.db.patch(row._id, { receivedChunks })
    return progress({ ...save, receivedChunks })
  }
})

export const publish = mutation({
  args: zodToConvexFields(sceneFogSaveLookupSchema.shape),
  returns: zodToConvex(sceneFogCommandResultSchema),
  handler: async (ctx, args) => {
    const lookup = sceneFogSaveLookupSchema.parse(args)
    const { row, save, header, campaign, userId, liveRow, live } = await readFogSave(
      ctx,
      lookup.saveId.toLowerCase()
    )
    if (save.geometrySaveId)
      throw new Error('Derived Scene fog saves cannot be published manually.')
    assertActive(campaign)
    const priorRow = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', header.id).eq('commandId', save.commandId)
      )
      .unique()
    await assertFogPresentation(ctx, campaign.id, save.input, priorRow !== null)
    if (priorRow) {
      if (priorRow.encoding !== 'FOG_PATCH') throw new Error('Scene command ID was already used.')
      const prior = parseFogCommand(priorRow, header.version)
      if (prior.inputChecksum !== save.inputChecksum || prior.result.patch.saveId !== save.id)
        throw new Error('Scene command ID was already used.')
      return sceneFogCommandResultSchema.parse({ ...prior.result, replayed: true })
    }
    if (
      save.status !== 'RECEIVING' ||
      save.actorUserId !== userId ||
      save.chunksRemoved ||
      save.expiresAt <= Date.now()
    )
      throw new Error('Scene fog save expired.')
    if (save.receivedChunks !== save.input.chunkManifest.length)
      throw new Error('Scene fog save is incomplete.')
    if (save.input.expectedSceneVersion > header.version)
      throw new Error('Scene version is ahead of the authoritative state.')
    const state = advanceLiveState(header, live)
    const { patch } = await publishFogLayer(ctx, save, header, state)
    const result = sceneFogCommandResultSchema.parse({
      sceneId: header.id,
      commandId: save.commandId,
      version: state.version,
      occurrence: null,
      replayed: false,
      patch
    })
    if (liveRow) await ctx.db.replace(liveRow._id, state)
    else await ctx.db.insert('sceneLiveStates', state)
    await ctx.db.patch(row._id, { status: 'PUBLISHED' })
    await ctx.db.insert(
      'sceneLiveCommands',
      sceneStoredFogCommandSchema.parse({
        encoding: 'FOG_PATCH',
        sceneId: header.id,
        commandId: save.commandId,
        actorUserId: userId,
        input: save.input,
        inputChecksum: save.inputChecksum,
        result,
        resultChecksum: checksumCanonicalJson(result)
      })
    )
    return result
  }
})

export const cleanup = internalMutation({
  args: { saveId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('sceneFogSaves')
      .withIndex('by_publicId', (q) => q.eq('id', args.saveId.toLowerCase()))
      .unique()
    if (!row) return null
    const save = parseFogSave(row)
    if (save.status === 'PUBLISHED' || save.chunksRemoved) return null
    if (save.status === 'RECEIVING' && save.expiresAt > Date.now()) {
      await ctx.scheduler.runAt(save.expiresAt, cleanupReference, { saveId: save.id })
      return null
    }
    if (save.status === 'RECEIVING') await ctx.db.patch(row._id, { status: 'EXPIRED' })
    const chunks = await ctx.db
      .query('sceneFogChunks')
      .withIndex('by_saveId_ordinal', (q) => q.eq('saveId', save.id))
      .take(9)
    for (const chunk of chunks.slice(0, 8)) await ctx.db.delete(chunk._id)
    if (chunks.length > 8) await ctx.scheduler.runAfter(0, cleanupReference, { saveId: save.id })
    else await ctx.db.patch(row._id, { chunksRemoved: true })
    return null
  }
})
