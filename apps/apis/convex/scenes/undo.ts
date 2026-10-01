import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { SCENE_GEOMETRY_STAGED_REQUIRED } from '@artificer-toolkit/schema/api/sceneGeometry'
import {
  sceneUndoCommandResultSchema,
  sceneUndoExecuteInputSchema,
  sceneUndoFinishInputSchema,
  sceneUndoPrepareInputSchema,
  sceneUndoPrepareResultSchema,
  type SceneUndoCommandResult,
  type SceneUndoExecuteInput,
  type SceneUndoFinishInput,
  type SceneUndoPrepareInput,
  type SceneUndoPrepareResult
} from '@artificer-toolkit/schema/api/sceneUndo'
import {
  sceneCommandResultDtoSchema,
  type SceneCommandInputDto,
  type SceneCommandResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneStoredLiveCommandSchema,
  sceneStoredUndoCommandSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson, equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { action, type MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { publishSceneUndo } from '@artificer-toolkit/encounter-persistence/sceneUndoPublication'
import { internalQuery } from '../lib/queries'
import { internalMutation, mutation } from '../lib/mutations'
import { consumeSceneWriteRateLimit } from '../lib/rateLimits'
import { advanceLiveState } from '@artificer-toolkit/encounter-persistence/sceneLiveState'
import {
  parseGeometryCommand,
  parseGeometrySave
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { parseLiveEntity, readLiveScene, readLiveSceneForUser } from './liveDocuments'
import { readPresentedVisionScene } from './sessionVisionDocuments'
import { assertConvexOwnsSceneLiveState } from '../liveSessions/authorityGuard'

const undoSearchPageSize = 8

function stagedRequired(): never {
  throw new ConvexError(SCENE_GEOMETRY_STAGED_REQUIRED)
}

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

function normalize(input: SceneUndoExecuteInput): SceneUndoExecuteInput {
  return {
    ...input,
    input: {
      ...input.input,
      sceneId: input.input.sceneId.toLowerCase(),
      commandId: input.input.commandId.toLowerCase()
    }
  }
}

function parseUndoCommand(
  row: Parameters<typeof sceneStoredUndoCommandSchema.parse>[0],
  version: number
) {
  const command = sceneStoredUndoCommandSchema.parse(row)
  if (
    command.inputChecksum !== checksumCanonicalJson(command.input) ||
    command.resultChecksum !== checksumCanonicalJson(command.result) ||
    command.sceneId !== command.input.sceneId ||
    command.commandId !== command.input.commandId ||
    command.sceneId !== command.result.sceneId ||
    command.commandId !== command.result.commandId ||
    command.result.replayed ||
    command.result.version > version ||
    command.undoneCommandId !== command.result.delta.undoneCommandId
  )
    throw new Error('Stored Scene undo command is inconsistent.')
  return command
}

async function currentPresentation(
  ctx: Parameters<typeof readPresentedVisionScene>[0],
  campaignId: string,
  sceneId: string,
  fence: SceneUndoExecuteInput['presentation']
) {
  if (!fence) return null
  return readPresentedVisionScene(ctx, { campaignId, sceneId })
}

function assertNewWrite(
  header: { version: number },
  input: SceneUndoExecuteInput,
  presented: Awaited<ReturnType<typeof currentPresentation>>
) {
  if (input.input.expectedSceneVersion !== header.version)
    throw new Error('Scene version is stale.')
  if (
    input.presentation &&
    presented &&
    presented.presentation.version !== input.presentation.expectedPresentationVersion
  )
    throw new Error('Scene vision presentation is stale.')
}

async function replay(
  ctx: Parameters<typeof readLiveScene>[0],
  sceneId: string,
  commandId: string,
  version: number,
  inputChecksum: string
) {
  const row = await ctx.db
    .query('sceneLiveCommands')
    .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', sceneId).eq('commandId', commandId))
    .unique()
  if (!row) return null
  if (row.encoding !== 'UNDO') throw new Error('Scene command ID was already used.')
  const prior = parseUndoCommand(stored(row), version)
  if (prior.inputChecksum !== inputChecksum) throw new Error('Scene command ID was already used.')
  return sceneUndoCommandResultSchema.parse({ ...prior.result, replayed: true })
}

export const prepare = internalQuery({
  args: zodToConvexFields(sceneUndoPrepareInputSchema.shape),
  returns: zodToConvex(sceneUndoPrepareResultSchema),
  handler: async (ctx, args): Promise<SceneUndoPrepareResult> => {
    const request = sceneUndoPrepareInputSchema.parse(args)
    const input = normalize(request)
    const { header, campaign } = await readLiveScene(ctx, input.input.sceneId, 'OWNER')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    await assertConvexOwnsSceneLiveState(ctx, campaign.id, header.id)
    const presented = await currentPresentation(ctx, campaign.id, header.id, input.presentation)
    const inputChecksum = checksumCanonicalJson(input.input)
    const prior = await replay(ctx, header.id, input.input.commandId, header.version, inputChecksum)
    if (prior) return { kind: 'REPLAY', result: prior }
    assertNewWrite(header, input, presented)

    const candidates = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_type_version', (q) =>
        q
          .eq('sceneId', header.id)
          .eq('input.type', 'MOVE_SCENE_TOKEN')
          .lt('result.version', header.version + 1)
      )
      .order('desc')
      .paginate({ numItems: undoSearchPageSize, cursor: request.cursor })
    if (candidates.page.length === 0 && candidates.isDone)
      throw new Error('There is no committed token move to undo.')
    for (const candidate of candidates.page) {
      const move = parseGeometryCommand(candidate, header.version)
      if (move.result.delta === null && move.result.fogPatches.length === 0) continue
      const undone = await ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_undoneCommandId', (q) =>
          q.eq('sceneId', header.id).eq('undoneCommandId', move.commandId)
        )
        .unique()
      if (!undone) {
        if (move.result.delta?.kind !== 'TOKEN_MOVED')
          throw new Error('The latest token move is invalid.')
        return {
          kind: 'READY',
          targetCommandId: move.commandId,
          beforeVersion: move.result.version
        }
      }
      if (undone.encoding !== 'UNDO') throw new Error('Stored Scene undo command is inconsistent.')
      parseUndoCommand(stored(undone), header.version)
    }
    if (candidates.isDone) throw new Error('There is no committed token move to undo.')
    return { kind: 'NEXT', cursor: candidates.continueCursor }
  }
})

async function finishUndo(
  ctx: MutationCtx,
  request: SceneUndoExecuteInput | SceneUndoFinishInput,
  fastOnly: boolean
): Promise<SceneUndoCommandResult> {
  const input = normalize(request)
  const { header, campaign, live, liveRow, userId } = await readLiveScene(
    ctx,
    input.input.sceneId,
    'OWNER'
  )
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  await assertConvexOwnsSceneLiveState(ctx, campaign.id, header.id)
  const presented = await currentPresentation(ctx, campaign.id, header.id, input.presentation)
  const inputChecksum = checksumCanonicalJson(input.input)
  const prior = await replay(ctx, header.id, input.input.commandId, header.version, inputChecksum)
  if (prior) return prior
  assertNewWrite(header, input, presented)

  let targetCommandId: string
  if (fastOnly) {
    const candidates = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_type_version', (q) =>
        q
          .eq('sceneId', header.id)
          .eq('input.type', 'MOVE_SCENE_TOKEN')
          .lt('result.version', header.version + 1)
      )
      .order('desc')
      .paginate({ numItems: undoSearchPageSize, cursor: null })
    if (candidates.page.length === 0 && candidates.isDone)
      throw new Error('There is no committed token move to undo.')
    targetCommandId = ''
    for (const candidate of candidates.page) {
      const move = parseGeometryCommand(candidate, header.version)
      if (move.result.delta === null && move.result.fogPatches.length === 0) continue
      const undone = await ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_undoneCommandId', (q) =>
          q.eq('sceneId', header.id).eq('undoneCommandId', move.commandId)
        )
        .unique()
      if (undone) {
        if (undone.encoding !== 'UNDO')
          throw new Error('Stored Scene undo command is inconsistent.')
        parseUndoCommand(stored(undone), header.version)
        continue
      }
      if (
        move.input.type !== 'MOVE_SCENE_TOKEN' ||
        move.result.delta?.kind !== 'TOKEN_MOVED' ||
        move.result.fogPatches.length > 0 ||
        move.result.occurrence !== null ||
        move.input.expectedEncounterVersion !== null
      )
        stagedRequired()
      targetCommandId = move.commandId
      break
    }
    if (!targetCommandId) {
      if (!candidates.isDone) stagedRequired()
      throw new Error('There is no committed token move to undo.')
    }
  } else {
    if (!('targetCommandId' in request)) throw new Error('The latest token move is unavailable.')
    targetCommandId = request.targetCommandId
  }

  const liveTokenIds = new Map<string, Id<'sceneLiveEntities'>>()
  const fogLayerIds = new Map<string, Id<'sceneFogLayers'>>()
  return publishSceneUndo(
    { header, live, userId, input, targetCommandId, fastOnly },
    {
      readSceneCommand: async (sceneId, commandId) => {
        const row = await ctx.db
          .query('sceneLiveCommands')
          .withIndex('by_sceneId_commandId', (q) =>
            q.eq('sceneId', sceneId).eq('commandId', commandId)
          )
          .unique()
        return row ? sceneStoredLiveCommandSchema.parse(stored(row)) : null
      },
      readUndoForMove: async (sceneId, commandId) => {
        const row = await ctx.db
          .query('sceneLiveCommands')
          .withIndex('by_sceneId_undoneCommandId', (q) =>
            q.eq('sceneId', sceneId).eq('undoneCommandId', commandId)
          )
          .unique()
        return row ? sceneStoredLiveCommandSchema.parse(stored(row)) : null
      },
      readGeometrySave: async (sceneId, commandId) => {
        const row = await ctx.db
          .query('sceneGeometrySaves')
          .withIndex('by_sceneId_commandId', (q) =>
            q.eq('sceneId', sceneId).eq('commandId', commandId)
          )
          .unique()
        return row ? stored(row) : null
      },
      readLiveToken: async (sceneId, tokenId) => {
        const row = await ctx.db
          .query('sceneLiveEntities')
          .withIndex('by_sceneId_collection_entityId', (q) =>
            q.eq('sceneId', sceneId).eq('collection', 'tokens').eq('entityId', tokenId)
          )
          .unique()
        if (!row) return null
        liveTokenIds.set(sceneId + ':' + tokenId, row._id)
        return stored(row)
      },
      readFogSave: async (saveId) => {
        const row = await ctx.db
          .query('sceneFogSaves')
          .withIndex('by_publicId', (q) => q.eq('id', saveId))
          .unique()
        return row ? stored(row) : null
      },
      readFogLayer: async (sceneId, ownerUserId) => {
        const row = await ctx.db
          .query('sceneFogLayers')
          .withIndex('by_sceneId_ownerUserId', (q) =>
            q.eq('sceneId', sceneId).eq('ownerUserId', ownerUserId)
          )
          .unique()
        if (!row) return null
        fogLayerIds.set(sceneId + ':' + (ownerUserId ?? ''), row._id)
        return stored(row)
      },
      writeFogLayer: async (value) => {
        const id = fogLayerIds.get(value.sceneId + ':' + (value.ownerUserId ?? ''))
        if (!id) throw new Error('Scene undo fog write has no captured row.')
        await ctx.db.replace(id, value)
      },
      deleteFogLayer: async (sceneId, ownerUserId) => {
        const id = fogLayerIds.get(sceneId + ':' + (ownerUserId ?? ''))
        if (!id) throw new Error('Scene undo fog deletion has no captured row.')
        await ctx.db.delete(id)
      },
      writeLiveToken: async (value) => {
        const id = liveTokenIds.get(value.sceneId + ':' + value.entityId)
        if (!id) throw new Error('Scene undo token write has no captured row.')
        await ctx.db.replace(id, value)
      },
      writeLiveState: async (value) => {
        if (liveRow) await ctx.db.replace(liveRow._id, value)
        else await ctx.db.insert('sceneLiveStates', value)
      },
      insertUndoCommand: async (value) => {
        await ctx.db.insert('sceneLiveCommands', value)
      },
      stagedRequired
    }
  )
}

type ResolvedUndoCommand = Extract<SceneCommandInputDto, { type: 'UNDO_LAST_SCENE_MOVE' }>

function compactUndoResult(result: SceneUndoCommandResult): SceneCommandResultDto {
  return sceneCommandResultDtoSchema.parse({
    commandId: result.commandId,
    delta: result.delta,
    occurrence: result.occurrence,
    replayed: result.replayed,
    sceneId: result.sceneId,
    version: result.version
  })
}

export async function publishResolvedUndoCommand(
  ctx: MutationCtx,
  args: {
    actorUserId: string
    actorRole: 'OWNER' | 'PLAYER'
    campaignId: string
    authorityScope: import('../campaigns/authority').CampaignInternalScope
    command: ResolvedUndoCommand
    presentation: { expectedPresentationVersion: number }
    expectedResult: SceneCommandResultDto
  }
): Promise<SceneCommandResultDto> {
  const request = normalize({ input: args.command, presentation: args.presentation })
  const input = request.input
  if (args.actorRole !== 'OWNER')
    throw new Error('Only the committed Campaign owner may undo a Scene move.')
  const { header, campaign, live, liveRow } = await readLiveSceneForUser(
    ctx,
    input.sceneId,
    'MEMBER',
    args.actorUserId,
    args.authorityScope
  )
  if (campaign.id !== args.campaignId)
    throw new Error('Live Session Scene publication Campaign identity mismatch.')

  const inputChecksum = checksumCanonicalJson(input)
  const priorRow = await ctx.db
    .query('sceneLiveCommands')
    .withIndex('by_sceneId_commandId', (q) =>
      q.eq('sceneId', header.id).eq('commandId', input.commandId)
    )
    .unique()
  if (priorRow) {
    if (priorRow.encoding !== 'UNDO') throw new Error('Scene command ID was already used.')
    const prior = parseUndoCommand(stored(priorRow), header.version)
    if (prior.inputChecksum !== inputChecksum || prior.actorUserId !== args.actorUserId)
      throw new Error('Scene command ID was already used.')
    const storedResult = compactUndoResult(prior.result)
    if (!equalCanonicalJson(storedResult, args.expectedResult))
      throw new Error('Live Session publication Scene result mismatch.')
    return storedResult
  }
  if (header.version !== input.expectedSceneVersion)
    throw new Error('Live Session publication Scene version is stale.')

  let cursor: string | null = null
  let target: ReturnType<typeof parseGeometryCommand> | null = null
  while (!target) {
    const candidates = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_type_version', (q) =>
        q
          .eq('sceneId', header.id)
          .eq('input.type', 'MOVE_SCENE_TOKEN')
          .lt('result.version', header.version + 1)
      )
      .order('desc')
      .paginate({ numItems: undoSearchPageSize, cursor })
    for (const candidate of candidates.page) {
      const move = parseGeometryCommand(candidate, header.version)
      const undone = await ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_undoneCommandId', (q) =>
          q.eq('sceneId', header.id).eq('undoneCommandId', move.commandId)
        )
        .unique()
      if (undone) {
        if (undone.encoding !== 'UNDO')
          throw new Error('Stored Scene undo command is inconsistent.')
        parseUndoCommand(stored(undone), header.version)
        continue
      }
      target = move
      break
    }
    if (target) break
    if (candidates.isDone) throw new Error('There is no committed token move to undo.')
    if (candidates.continueCursor === cursor)
      throw new Error('Scene undo history pagination did not advance.')
    cursor = candidates.continueCursor
  }
  if (
    target.input.type !== 'MOVE_SCENE_TOKEN' ||
    target.input.expectedEncounterVersion !== null ||
    target.result.delta?.kind !== 'TOKEN_MOVED' ||
    target.result.fogPatches.length !== 0 ||
    target.result.occurrence !== null
  )
    throw new Error('The latest token move is not a standalone live Session move.')

  const targetInput = target.input

  const parentRow = await ctx.db
    .query('sceneGeometrySaves')
    .withIndex('by_sceneId_commandId', (q) =>
      q.eq('sceneId', header.id).eq('commandId', target.commandId)
    )
    .unique()
  if (!parentRow) throw new Error('Stored Scene geometry save is inconsistent.')
  const parent = parseGeometrySave(parentRow)
  if (
    parent.status !== 'PUBLISHED' ||
    parent.inputChecksum !== target.inputChecksum ||
    parent.actorUserId !== target.actorUserId ||
    parent.input.type !== 'MOVE_SCENE_TOKEN' ||
    parent.fogSaves.length !== 0 ||
    parent.movementResolution !== undefined ||
    parent.spatialPreparationJson !== undefined ||
    parent.spatialPreparationChecksum !== undefined ||
    parent.sessionVision !== undefined ||
    parent.characterRevisions !== undefined
  )
    throw new Error('Stored Scene geometry save is inconsistent.')

  const tokenRow = await ctx.db
    .query('sceneLiveEntities')
    .withIndex('by_sceneId_collection_entityId', (q) =>
      q.eq('sceneId', header.id).eq('collection', 'tokens').eq('entityId', targetInput.tokenId)
    )
    .unique()
  if (!tokenRow) throw new Error('The latest token move can no longer be safely undone.')
  const token = parseLiveEntity(tokenRow, header.version)
  if (token.version !== target.result.version || token.value?.collection !== 'tokens')
    throw new Error('The latest token move can no longer be safely undone.')

  const state = advanceLiveState(header, live)
  const position = targetInput.path[0]!
  const value = { ...token.value, entity: { ...token.value.entity, position } }
  const restoredToken = {
    sceneId: header.id,
    collection: token.collection,
    entityId: token.entityId,
    value,
    doorState: token.doorState,
    ordinal: token.ordinal,
    version: state.version
  }
  const expectedResult = sceneCommandResultDtoSchema.parse({
    sceneId: header.id,
    commandId: input.commandId,
    version: state.version,
    replayed: false,
    occurrence: null,
    delta: {
      kind: 'TOKEN_MOVE_UNDONE',
      tokenId: targetInput.tokenId,
      position,
      undoneCommandId: target.commandId
    }
  })
  if (!equalCanonicalJson(expectedResult, args.expectedResult))
    throw new Error('Live Session publication Scene result mismatch.')
  const result = sceneUndoCommandResultSchema.parse({
    ...expectedResult,
    restoredFogOwners: []
  })

  await ctx.db.replace(tokenRow._id, {
    ...restoredToken,
    checksum: checksumCanonicalJson(restoredToken)
  })
  if (liveRow) await ctx.db.replace(liveRow._id, state)
  else await ctx.db.insert('sceneLiveStates', state)
  await ctx.db.insert(
    'sceneLiveCommands',
    sceneStoredUndoCommandSchema.parse({
      encoding: 'UNDO',
      sceneId: header.id,
      commandId: input.commandId,
      actorUserId: args.actorUserId,
      input,
      inputChecksum,
      result,
      resultChecksum: checksumCanonicalJson(result),
      undoneCommandId: target.commandId
    })
  )
  return expectedResult
}

export const finish = internalMutation({
  args: zodToConvexFields(sceneUndoFinishInputSchema.shape),
  returns: zodToConvex(sceneUndoCommandResultSchema),
  handler: async (ctx, args): Promise<SceneUndoCommandResult> => {
    await consumeSceneWriteRateLimit(ctx)
    return finishUndo(ctx, sceneUndoFinishInputSchema.parse(args), false)
  }
})

export const executeFast = mutation({
  args: zodToConvexFields(sceneUndoExecuteInputSchema.shape),
  returns: zodToConvex(sceneUndoCommandResultSchema),
  handler: async (ctx, args): Promise<SceneUndoCommandResult> => {
    await consumeSceneWriteRateLimit(ctx)
    return finishUndo(ctx, sceneUndoExecuteInputSchema.parse(args), true)
  }
})

const prepareReference = makeFunctionReference<
  'query',
  SceneUndoPrepareInput,
  SceneUndoPrepareResult
>('scenes/undo:prepare')
const finishReference = makeFunctionReference<
  'mutation',
  SceneUndoFinishInput,
  SceneUndoCommandResult
>('scenes/undo:finish')

export const execute = action({
  args: zodToConvexFields(sceneUndoExecuteInputSchema.shape),
  returns: zodToConvex(sceneUndoCommandResultSchema),
  handler: async (ctx, args): Promise<SceneUndoCommandResult> => {
    const input = normalize(sceneUndoExecuteInputSchema.parse(args))
    let cursor: string | null = null
    while (true) {
      const prepared = sceneUndoPrepareResultSchema.parse(
        await ctx.runQuery(prepareReference, { ...input, cursor })
      )
      if (prepared.kind === 'REPLAY') return prepared.result
      if (prepared.kind === 'READY')
        return ctx.runMutation(finishReference, {
          ...input,
          targetCommandId: prepared.targetCommandId
        })
      if (prepared.cursor === cursor)
        throw new Error('Scene undo history pagination did not advance.')
      cursor = prepared.cursor
    }
  }
})
