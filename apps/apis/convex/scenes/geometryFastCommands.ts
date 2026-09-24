import { ConvexError } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneGeometryCommandResultSchema,
  sceneGeometryExecuteInputSchema,
  SCENE_GEOMETRY_STAGED_REQUIRED,
  type SceneGeometryCommandResult,
  type SceneGeometryExecuteInput,
  type SceneGeometryEntity,
  type SceneGeometryPage,
  type SceneNativeGeometryCommandInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import {
  sceneCommandResultDtoSchema,
  type SceneCommandResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import {
  sceneStoredGeometryCommandSchema,
  sceneStoredLiveEntitySchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson, equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { applySceneGeometryDelta, sceneTokenMovementFailure } from '@artificer-toolkit/shared/vtt'

import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { readCurrentEntitiesFromScene } from './currentEntities'
import { parseGeometryCommand, parseGeometrySave } from './geometryDocuments'
import {
  geometryTarget,
  normalizeGeometryInput,
  normalizeSceneGeometryEntity
} from './geometryValues'
import {
  advanceLiveState,
  parseLiveEntity,
  readLiveScene,
  readLiveSceneForUser
} from './liveDocuments'
import { readPresentedVisionScene } from './sessionVisionDocuments'
import { assertConvexOwnsSceneLiveState } from '../liveSessions/authorityGuard'

const fastEntityLimit = 16
const saveWindow = 24 * 60 * 60_000

function stagedRequired(): never {
  throw new ConvexError(SCENE_GEOMETRY_STAGED_REQUIRED)
}

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

async function readBoundedCollection(
  ctx: MutationCtx,
  scene: Pick<Awaited<ReturnType<typeof readLiveScene>>, 'header' | 'live'>,
  collection: 'tokens' | 'barriers',
  entityLimit = fastEntityLimit
) {
  const { header } = scene
  if (header.counts[collection] > entityLimit || header.currentCounts[collection] > entityLimit)
    return null

  const [definitionEntities, liveEntities] = await Promise.all([
    ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q.eq('saveId', header.definitionSaveId).eq('value.collection', collection)
      )
      .take(entityLimit + 1),
    ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', header.id).eq('collection', collection)
      )
      .take(entityLimit + 1)
  ])
  if (definitionEntities.length > entityLimit || liveEntities.length > entityLimit) return null

  const entities: SceneGeometryPage['page'] = []
  let next: SceneGeometryPage['next'] = { phase: 'BASE', afterOrdinal: null }
  try {
    while (next) {
      const page = await readCurrentEntitiesFromScene(
        ctx,
        {
          sceneId: header.id,
          expectedVersion: header.version,
          definitionSaveId: header.definitionSaveId,
          collection,
          numItems: 8,
          ...next
        },
        scene,
        { definitionEntities, liveEntities }
      )
      for (const entry of page.page) {
        if (entry.value.collection === 'tokens' || entry.value.collection === 'barriers')
          entities.push({ ...entry, value: entry.value })
        else stagedRequired()
      }
      next = page.next
    }
  } catch {
    stagedRequired()
  }
  if (entities.length !== header.currentCounts[collection]) stagedRequired()
  return { entities, liveEntities }
}

async function readDoorTarget(
  ctx: MutationCtx,
  header: Awaited<ReturnType<typeof readLiveScene>>['header'],
  barrierId: string,
  expectedSceneVersion: number
) {
  const [overrideRow, baseRow] = await Promise.all([
    ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', header.id).eq('collection', 'barriers').eq('entityId', barrierId)
      )
      .unique(),
    ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_entityId', (q) =>
        q
          .eq('saveId', header.definitionSaveId)
          .eq('value.collection', 'barriers')
          .eq('entityId', barrierId)
      )
      .unique()
  ])
  const override = overrideRow ? parseLiveEntity(overrideRow, header.version) : null
  if (override && override.version > expectedSceneVersion)
    throw new Error('Scene target changed before this command completed.')
  const base = baseRow ? sceneStoredDefinitionEntitySchema.parse(stored(baseRow)) : null
  if (
    base &&
    (base.saveId !== header.definitionSaveId ||
      base.value.collection !== 'barriers' ||
      base.ordinal >= header.counts.barriers ||
      base.checksum !== checksumCanonicalJson(base.value) ||
      base.entityId !== base.value.entity.id ||
      base.entityId.toLowerCase() !== barrierId)
  )
    throw new Error('Stored Scene geometry source is inconsistent.')

  const baseBarrier =
    base?.value.collection === 'barriers' ? normalizeSceneGeometryEntity(base.value) : null
  const current = override?.value
    ? override.value.collection === 'barriers'
      ? normalizeSceneGeometryEntity(override.value)
      : null
    : baseBarrier
  return {
    current,
    doorState: override
      ? (override.doorState ?? null)
      : current?.collection === 'barriers' && current.entity.kind === 'DOOR'
        ? current.entity.initialState
        : null,
    ordinal: override ? override.ordinal : (base?.ordinal ?? null),
    overrideRow
  }
}

async function executeGeometryFast(
  ctx: MutationCtx,
  args: SceneGeometryExecuteInput
): Promise<SceneGeometryCommandResult> {
  const input = normalizeGeometryInput(args.input)
  const { header, campaign, membership, userId, liveRow, live } = await readLiveScene(
    ctx,
    input.sceneId,
    input.type === 'MOVE_SCENE_TOKEN' ? 'MEMBER' : 'OWNER'
  )
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (input.type === 'SET_SCENE_DOOR_STATE' || input.type === 'MOVE_SCENE_TOKEN')
    await assertConvexOwnsSceneLiveState(ctx, campaign.id, header.id)
  if (args.presentation) {
    const presented = await readPresentedVisionScene(ctx, {
      campaignId: campaign.id,
      sceneId: header.id
    })
    if (presented.presentation.version !== args.presentation.expectedPresentationVersion)
      throw new Error('Scene vision presentation is stale.')
  }

  const inputChecksum = checksumCanonicalJson(input)
  const [priorSaveRow, priorCommandRow] = await Promise.all([
    ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', header.id).eq('commandId', input.commandId)
      )
      .unique(),
    ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', header.id).eq('commandId', input.commandId)
      )
      .unique()
  ])
  const priorSave = priorSaveRow ? parseGeometrySave(priorSaveRow) : null
  if (priorCommandRow) {
    if (priorCommandRow.encoding !== 'GEOMETRY')
      throw new Error('Scene command ID was already used.')
    const prior = parseGeometryCommand(priorCommandRow, header.version)
    if (prior.inputChecksum !== inputChecksum) throw new Error('Scene command ID was already used.')
    if (
      !priorSave ||
      priorSave.status !== 'PUBLISHED' ||
      priorSave.inputChecksum !== inputChecksum ||
      priorSave.actorUserId !== prior.actorUserId
    )
      throw new Error('Stored Scene geometry save is inconsistent.')
    return sceneGeometryCommandResultSchema.parse({ ...prior.result, replayed: true })
  }

  if (priorSave) {
    if (priorSave.inputChecksum !== inputChecksum || priorSave.actorUserId !== userId)
      throw new Error('Scene geometry command was already used.')
    if (priorSave.status === 'PUBLISHED')
      throw new Error('Stored Scene geometry save is inconsistent.')
    if (priorSave.status === 'RECEIVING') stagedRequired()
    throw new Error('Scene geometry save expired.')
  }
  if (input.type !== 'SET_SCENE_DOOR_STATE' && input.type !== 'MOVE_SCENE_TOKEN') stagedRequired()
  if (input.expectedSceneVersion > header.version)
    throw new Error('Scene version is ahead of the authoritative state.')

  const target = geometryTarget(input)
  let overrideRow: Doc<'sceneLiveEntities'> | null = null
  let current: SceneGeometryEntity | null = null
  let ordinal: number | null = null
  let doorState: 'OPEN' | 'CLOSED' | 'LOCKED' | null = null

  if (input.type === 'SET_SCENE_DOOR_STATE') {
    const target = await readDoorTarget(ctx, header, input.barrierId, input.expectedSceneVersion)
    overrideRow = target.overrideRow
    if (
      await ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_sceneId', (q) => q.eq('sceneId', header.id))
        .first()
    )
      stagedRequired()
    if (header.fogLayerCount !== 0) stagedRequired()
    const tokenSnapshot = await readBoundedCollection(ctx, { header, live }, 'tokens')
    if (
      !tokenSnapshot ||
      tokenSnapshot.entities.some(
        ({ value }) => value.collection !== 'tokens' || value.entity.vision?.enabled === true
      )
    )
      stagedRequired()

    current = target.current
    ordinal = target.ordinal
    doorState = target.doorState
  } else {
    if (input.expectedEncounterVersion !== null || header.fogLayerCount !== 0) stagedRequired()
    const [tokenSnapshot, barrierSnapshot] = await Promise.all([
      readBoundedCollection(ctx, { header, live }, 'tokens'),
      readBoundedCollection(ctx, { header, live }, 'barriers')
    ])
    if (!tokenSnapshot || !barrierSnapshot) stagedRequired()
    const tokens = tokenSnapshot.entities.map(({ value }) => {
      if (value.collection !== 'tokens') stagedRequired()
      return value.entity
    })
    if (tokens.some((token) => token.vision?.enabled === true)) stagedRequired()
    const barriers = barrierSnapshot.entities.map(({ value }) => {
      if (value.collection !== 'barriers') stagedRequired()
      return value.entity
    })
    const doorStates: Record<string, 'OPEN' | 'CLOSED' | 'LOCKED'> = {}
    for (const entry of barrierSnapshot.entities) {
      if (entry.value.collection !== 'barriers') stagedRequired()
      if (entry.value.entity.kind !== 'DOOR') continue
      if (entry.doorState === null) stagedRequired()
      doorStates[entry.value.entity.id] = entry.doorState
    }

    const matchingOverrides = tokenSnapshot.liveEntities.filter(
      (row) => row.entityId === input.tokenId
    )
    if (matchingOverrides.length > 1) stagedRequired()
    overrideRow = matchingOverrides[0] ?? null
    const override = overrideRow ? parseLiveEntity(overrideRow, header.version) : null
    if (override && override.version > input.expectedSceneVersion)
      throw new Error('Scene target changed before this command completed.')
    const targetEntry = tokenSnapshot.entities.find(
      ({ value }) => value.collection === 'tokens' && value.entity.id === input.tokenId
    )
    current = targetEntry?.value ?? null
    ordinal = targetEntry?.ordinal ?? null

    const [sceneBinding, actorBinding] = await Promise.all([
      ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_sceneId', (q) => q.eq('sceneId', header.id))
        .first(),
      ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_sceneId_tokenId', (q) =>
          q.eq('sceneId', header.id).eq('tokenId', input.tokenId)
        )
        .first()
    ])
    if (sceneBinding || actorBinding) stagedRequired()

    const movementFailure = sceneTokenMovementFailure(
      { map: header.map, tokens, barriers, doorStates },
      input.tokenId,
      input.path.at(-1)!,
      input.path
    )
    if (movementFailure) throw new Error(movementFailure)
    const movingToken = current?.collection === 'tokens' ? current.entity : null
    if (
      !movingToken ||
      movingToken.locked ||
      (membership.role !== 'OWNER' && !movingToken.controlledByUserIds.includes(userId))
    )
      throw new Error('Members may only move an unlocked token they control.')
  }
  const reduced = applySceneGeometryDelta(
    {
      tokens: current?.collection === 'tokens' ? [current.entity] : [],
      barriers: current?.collection === 'barriers' ? [current.entity] : [],
      doorStates:
        current?.collection === 'barriers' && current.entity.kind === 'DOOR' && doorState
          ? { [current.entity.id]: doorState }
          : {}
    },
    target.delta
  )
  let value: SceneGeometryEntity | null = null
  if (target.collection === 'tokens') {
    const entity = reduced.tokens[0] ?? null
    value = entity ? normalizeSceneGeometryEntity({ collection: 'tokens', entity }) : null
  } else {
    const entity = reduced.barriers[0] ?? null
    value = entity ? normalizeSceneGeometryEntity({ collection: 'barriers', entity }) : null
  }
  const resultingDoorState =
    value?.collection === 'barriers' && value.entity.kind === 'DOOR'
      ? (reduced.doorStates[value.entity.id] ?? null)
      : null
  const state = advanceLiveState(header, live)
  const change = sceneStoredLiveEntitySchema.parse({
    sceneId: header.id,
    collection: target.collection,
    entityId: target.entityId,
    value,
    doorState: resultingDoorState,
    ordinal,
    version: state.version,
    checksum: checksumCanonicalJson({
      sceneId: header.id,
      collection: target.collection,
      entityId: target.entityId,
      value,
      doorState: resultingDoorState,
      ordinal,
      version: state.version
    })
  })
  const result = sceneGeometryCommandResultSchema.parse({
    sceneId: header.id,
    commandId: input.commandId,
    version: state.version,
    occurrence: null,
    replayed: false,
    delta: target.delta,
    fogPatches: []
  })
  const save = sceneStoredGeometrySaveSchema.parse({
    id: crypto.randomUUID(),
    sceneId: header.id,
    commandId: input.commandId,
    actorUserId: userId,
    input,
    inputChecksum,
    snapshotVersion: header.version,
    status: 'PUBLISHED',
    expiresAt: Date.now() + saveWindow,
    fogSaves: []
  })
  const command = sceneStoredGeometryCommandSchema.parse({
    encoding: 'GEOMETRY',
    sceneId: header.id,
    commandId: input.commandId,
    actorUserId: userId,
    input,
    inputChecksum,
    result,
    resultChecksum: checksumCanonicalJson(result)
  })

  await ctx.db.insert('sceneGeometrySaves', save)
  if (overrideRow) await ctx.db.replace(overrideRow._id, change)
  else await ctx.db.insert('sceneLiveEntities', change)
  if (liveRow) await ctx.db.replace(liveRow._id, state)
  else await ctx.db.insert('sceneLiveStates', state)
  await ctx.db.insert('sceneLiveCommands', command)
  return result
}

type ResolvedGeometryCommand = Extract<
  SceneNativeGeometryCommandInput,
  { type: 'SET_SCENE_DOOR_STATE' | 'MOVE_SCENE_TOKEN' }
>

export async function publishResolvedGeometryCommand(
  ctx: MutationCtx,
  args: {
    actorUserId: string
    actorRole: 'OWNER' | 'PLAYER'
    campaignId: string
    authorityScope: import('../campaigns/authority').CampaignInternalScope
    command: ResolvedGeometryCommand
    presentation: { expectedPresentationVersion: number }
    expectedResult: SceneCommandResultDto
  }
) {
  const input = normalizeGeometryInput(args.command)
  if (input.type !== 'SET_SCENE_DOOR_STATE' && input.type !== 'MOVE_SCENE_TOKEN')
    throw new Error('Live Session Scene publication command is unsupported.')

  if (input.type === 'SET_SCENE_DOOR_STATE' && args.actorRole !== 'OWNER')
    throw new Error('Only the committed Campaign owner may set a Scene door state.')

  const { header, campaign, liveRow, live } = await readLiveSceneForUser(
    ctx,
    input.sceneId,
    'MEMBER',
    args.actorUserId,
    args.authorityScope
  )
  if (campaign.id !== args.campaignId)
    throw new Error('Live Session Scene publication Campaign identity mismatch.')

  const inputChecksum = checksumCanonicalJson(input)
  const [priorSaveRow, priorCommandRow] = await Promise.all([
    ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', header.id).eq('commandId', input.commandId)
      )
      .unique(),
    ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', header.id).eq('commandId', input.commandId)
      )
      .unique()
  ])
  const priorSave = priorSaveRow ? parseGeometrySave(priorSaveRow) : null
  if (priorCommandRow) {
    if (priorCommandRow.encoding !== 'GEOMETRY')
      throw new Error('Scene command ID was already used.')
    const prior = parseGeometryCommand(priorCommandRow, header.version)
    if (
      prior.inputChecksum !== inputChecksum ||
      !priorSave ||
      priorSave.status !== 'PUBLISHED' ||
      priorSave.inputChecksum !== inputChecksum ||
      priorSave.actorUserId !== args.actorUserId
    )
      throw new Error('Scene command ID was already used.')
    const storedResult = sceneCommandResultDtoSchema.parse({
      commandId: prior.result.commandId,
      delta: prior.result.delta,
      occurrence: prior.result.occurrence,
      replayed: prior.result.replayed,
      sceneId: prior.result.sceneId,
      version: prior.result.version
    })
    if (!equalCanonicalJson(storedResult, args.expectedResult))
      throw new Error('Live Session publication Scene result mismatch.')
    return storedResult
  }
  if (priorSave)
    throw new Error(
      priorSave.inputChecksum === inputChecksum && priorSave.actorUserId === args.actorUserId
        ? 'Stored Scene geometry save is inconsistent.'
        : 'Scene geometry command was already used.'
    )
  if (header.version !== input.expectedSceneVersion)
    throw new Error('Live Session publication Scene version is stale.')

  const target = geometryTarget(input)
  const expectedResult = sceneCommandResultDtoSchema.parse({
    commandId: input.commandId,
    delta: target.delta,
    occurrence: null,
    replayed: false,
    sceneId: header.id,
    version: header.version + 1
  })
  if (!equalCanonicalJson(expectedResult, args.expectedResult))
    throw new Error('Live Session publication Scene result mismatch.')

  let overrideRow: Doc<'sceneLiveEntities'> | null = null
  let current: SceneGeometryEntity | null = null
  let ordinal: number | null = null
  let doorState: 'OPEN' | 'CLOSED' | 'LOCKED' | null = null
  if (input.type === 'SET_SCENE_DOOR_STATE') {
    const target = await readDoorTarget(ctx, header, input.barrierId, input.expectedSceneVersion)
    overrideRow = target.overrideRow
    current = target.current
    ordinal = target.ordinal
    doorState = target.doorState
  } else {
    if (input.expectedEncounterVersion !== null)
      throw new Error('Live Session publication only supports standalone token movement.')
    if (header.fogLayerCount !== 0)
      throw new Error('Live Session publication cannot bypass Scene fog mechanics.')
    const tokenLimit = Math.max(
      header.counts.tokens,
      header.currentCounts.tokens,
      live?.nextOrdinals.tokens ?? 0
    )
    const barrierLimit = Math.max(
      header.counts.barriers,
      header.currentCounts.barriers,
      live?.nextOrdinals.barriers ?? 0
    )
    const [tokenSnapshot, barrierSnapshot, sceneBinding, actorBinding] = await Promise.all([
      readBoundedCollection(ctx, { header, live }, 'tokens', tokenLimit),
      readBoundedCollection(ctx, { header, live }, 'barriers', barrierLimit),
      ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_sceneId', (q) => q.eq('sceneId', header.id))
        .first(),
      ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_sceneId_tokenId', (q) =>
          q.eq('sceneId', header.id).eq('tokenId', input.tokenId)
        )
        .first()
    ])
    if (!tokenSnapshot || !barrierSnapshot)
      throw new Error('Live Session publication Scene geometry is unavailable.')
    if (sceneBinding || actorBinding)
      throw new Error('Live Session publication only supports standalone token movement.')
    const tokens = tokenSnapshot.entities.map(({ value }) => {
      if (value.collection !== 'tokens')
        throw new Error('Live Session publication Scene geometry is inconsistent.')
      return value.entity
    })
    if (tokens.some((token) => token.vision?.enabled === true))
      throw new Error('Live Session publication cannot bypass Scene vision mechanics.')
    const barriers = barrierSnapshot.entities.map(({ value }) => {
      if (value.collection !== 'barriers')
        throw new Error('Live Session publication Scene geometry is inconsistent.')
      return value.entity
    })
    const doorStates: Record<string, 'OPEN' | 'CLOSED' | 'LOCKED'> = {}
    for (const entry of barrierSnapshot.entities) {
      if (entry.value.collection !== 'barriers')
        throw new Error('Live Session publication Scene geometry is inconsistent.')
      if (entry.value.entity.kind !== 'DOOR') continue
      if (entry.doorState === null)
        throw new Error('Live Session publication Scene geometry is inconsistent.')
      doorStates[entry.value.entity.id] = entry.doorState
    }
    const matchingOverrides = tokenSnapshot.liveEntities.filter(
      (row) => row.entityId === input.tokenId
    )
    if (matchingOverrides.length > 1)
      throw new Error('Live Session publication Scene geometry is inconsistent.')
    overrideRow = matchingOverrides[0] ?? null
    const override = overrideRow ? parseLiveEntity(overrideRow, header.version) : null
    if (override && override.version > input.expectedSceneVersion)
      throw new Error('Scene target changed before this command completed.')
    const targetEntry = tokenSnapshot.entities.find(
      ({ value }) => value.collection === 'tokens' && value.entity.id === input.tokenId
    )
    current = targetEntry?.value ?? null
    ordinal = targetEntry?.ordinal ?? null
    const failure = sceneTokenMovementFailure(
      { map: header.map, tokens, barriers, doorStates },
      input.tokenId,
      input.path.at(-1)!,
      input.path
    )
    if (failure) throw new Error(failure)
    const movingToken = current?.collection === 'tokens' ? current.entity : null
    if (
      !movingToken ||
      movingToken.locked ||
      (args.actorRole !== 'OWNER' && !movingToken.controlledByUserIds.includes(args.actorUserId))
    )
      throw new Error('Members may only move an unlocked token they control.')
  }
  const reduced = applySceneGeometryDelta(
    {
      tokens: current?.collection === 'tokens' ? [current.entity] : [],
      barriers: current?.collection === 'barriers' ? [current.entity] : [],
      doorStates:
        current?.collection === 'barriers' && current.entity.kind === 'DOOR' && doorState
          ? { [current.entity.id]: doorState }
          : {}
    },
    target.delta
  )
  let value: SceneGeometryEntity | null = null
  if (target.collection === 'tokens') {
    const entity = reduced.tokens[0] ?? null
    value = entity ? normalizeSceneGeometryEntity({ collection: 'tokens', entity }) : null
  } else {
    const entity = reduced.barriers[0] ?? null
    value = entity ? normalizeSceneGeometryEntity({ collection: 'barriers', entity }) : null
  }
  const resultingDoorState =
    value?.collection === 'barriers' && value.entity.kind === 'DOOR'
      ? (reduced.doorStates[value.entity.id] ?? null)
      : null
  const state = advanceLiveState(header, live)
  const change = sceneStoredLiveEntitySchema.parse({
    sceneId: header.id,
    collection: target.collection,
    entityId: target.entityId,
    value,
    doorState: resultingDoorState,
    ordinal,
    version: state.version,
    checksum: checksumCanonicalJson({
      sceneId: header.id,
      collection: target.collection,
      entityId: target.entityId,
      value,
      doorState: resultingDoorState,
      ordinal,
      version: state.version
    })
  })
  const result = sceneGeometryCommandResultSchema.parse({ ...expectedResult, fogPatches: [] })
  const save = sceneStoredGeometrySaveSchema.parse({
    id: crypto.randomUUID(),
    sceneId: header.id,
    commandId: input.commandId,
    actorUserId: args.actorUserId,
    input,
    inputChecksum,
    snapshotVersion: header.version,
    status: 'PUBLISHED',
    expiresAt: Date.now() + saveWindow,
    fogSaves: []
  })
  const command = sceneStoredGeometryCommandSchema.parse({
    encoding: 'GEOMETRY',
    sceneId: header.id,
    commandId: input.commandId,
    actorUserId: args.actorUserId,
    input,
    inputChecksum,
    result,
    resultChecksum: checksumCanonicalJson(result)
  })
  await ctx.db.insert('sceneGeometrySaves', save)
  if (overrideRow) await ctx.db.replace(overrideRow._id, change)
  else await ctx.db.insert('sceneLiveEntities', change)
  if (liveRow) await ctx.db.replace(liveRow._id, state)
  else await ctx.db.insert('sceneLiveStates', state)
  await ctx.db.insert('sceneLiveCommands', command)
  return expectedResult
}
export const execute = mutation({
  args: zodToConvexFields(sceneGeometryExecuteInputSchema.shape),
  returns: zodToConvex(sceneGeometryCommandResultSchema),
  handler: (ctx, args) => executeGeometryFast(ctx, sceneGeometryExecuteInputSchema.parse(args))
})
