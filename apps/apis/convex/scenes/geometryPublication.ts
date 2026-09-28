import type { EncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import {
  sceneGeometryFinishInputSchema,
  sceneGeometryCommandResultSchema,
  type SceneGeometryEntity,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import {
  sceneStoredGeometryCommandSchema,
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  applySceneGeometryDelta,
  sceneDoorChangeFailure,
  sceneLengthInFeet
} from '@artificer-toolkit/shared/vtt'
import { preparedMovementSceneDelta } from '@artificer-toolkit/rules-runtime/encounterMovementPublication'
import type { MutationCtx } from '../_generated/server'
import { parseFogSave } from './fogDocuments'
import {
  assertGeometryReceiving,
  assertStandaloneMovement,
  parseGeometryCommand,
  readSpatialPreparation,
  readGeometrySave
} from './geometryDocuments'
import { geometryTarget, normalizeSceneGeometryEntity } from './geometryValues'
import { advanceLiveState, parseLiveEntity } from './liveDocuments'
import { publishFogLayer } from './fogPublication'
import { readSessionVisionScope } from './sessionVisionDocuments'
import { readSpatialSceneGeometry } from './spatialGeometry'
import { assertSceneVisionCharacters } from './visionFreshness'
import { requireBoundTokenMoveControl } from '@artificer-toolkit/encounter-persistence/actorController'
import { recordTurnMovement } from '@artificer-toolkit/encounter-persistence/turnMovement'
import { encounterReadTransaction, encounterWriteTransaction } from '../encounters/encounterPorts'

type SceneGeometryFinishInput = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
type SceneGeometrySaveRead = Awaited<ReturnType<typeof readGeometrySave>>
type SpatialSceneGeometry = Awaited<ReturnType<typeof readSpatialSceneGeometry>>
type SpatialTerminalGeometry = Pick<SpatialSceneGeometry, 'sceneTokens' | 'actorIdByTokenId'>

export type SceneGeometryPublication = {
  publishPreparedMovementResponse: (
    ctx: MutationCtx,
    request: SceneGeometryFinishInput,
    geometry: SpatialTerminalGeometry | null
  ) => Promise<{ occurrence: EncounterRuleOccurrenceSummaryDto }>
  publishPreparedSpatialPending: (
    ctx: MutationCtx,
    request: SceneGeometryFinishInput,
    geometry: SpatialSceneGeometry | null
  ) => Promise<{
    occurrence: SceneGeometryCommandResult['occurrence']
    retainedOccurrence: SceneGeometryCommandResult['occurrence']
  }>
  publishPreparedSpatialTerminal: (
    ctx: MutationCtx,
    saveId: string,
    geometry: SpatialTerminalGeometry,
    request?: SceneGeometryFinishInput
  ) => Promise<{ occurrence: SceneGeometryCommandResult['occurrence'] }>
  verifyPreparedUninterruptedMovement: (
    ctx: MutationCtx,
    request: SceneGeometryFinishInput,
    geometry: SpatialTerminalGeometry
  ) => Promise<void>
}

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

function assertMoveTokenControl(
  token: { controlledByUserIds: readonly string[]; locked: boolean } | null,
  userId: string,
  owner: boolean
) {
  if (!token || token.locked || (!owner && !token.controlledByUserIds.includes(userId)))
    throw new Error('Members may only move an unlocked token they control.')
}

/** `rules` publishes Encounter-bound movement; only the Session room supplies it (D43). */
export async function publishSceneGeometry(
  ctx: MutationCtx,
  args: SceneGeometryFinishInput,
  rules: SceneGeometryPublication | null,
  previouslyRead?: SceneGeometrySaveRead
): Promise<SceneGeometryCommandResult> {
  const input = sceneGeometryFinishInputSchema.parse(args)
  const currentSave = previouslyRead ?? (await readGeometrySave(ctx, input.saveId.toLowerCase()))
  if (currentSave.save.id !== input.saveId.toLowerCase())
    throw new Error('Stored Scene geometry save is inconsistent.')
  const {
    row: saveRow,
    save,
    header,
    campaign,
    membership,
    userId,
    liveRow,
    live,
    presented
  } = currentSave
  const preparation = readSpatialPreparation(save)
  const bound =
    save.input.type === 'MOVE_SCENE_TOKEN' && save.input.expectedEncounterVersion !== null
  if (bound !== (rules !== null) || (bound && !preparation))
    throw new Error('Only the Session room publishes Encounter-bound movement, with its rules.')
  const priorRow = await ctx.db
    .query('sceneLiveCommands')
    .withIndex('by_sceneId_commandId', (q) =>
      q.eq('sceneId', header.id).eq('commandId', save.commandId)
    )
    .unique()
  if (priorRow) {
    if (priorRow.encoding !== 'GEOMETRY') throw new Error('Scene command ID was already used.')
    const prior = parseGeometryCommand(priorRow, header.version)
    if (prior.inputChecksum !== save.inputChecksum)
      throw new Error('Scene command ID was already used.')
    if (save.movementResolution && rules) {
      const replay = await rules.publishPreparedMovementResponse(ctx, input, null)
      return sceneGeometryCommandResultSchema.parse({
        ...prior.result,
        occurrence: replay.occurrence,
        replayed: true
      })
    }
    if (rules) {
      if (preparation?.outcome.kind === 'UNINTERRUPTED') {
        if (
          save.actorUserId !== userId ||
          prior.result.occurrence !== null ||
          checksumCanonicalJson(prior.result.delta) !==
            checksumCanonicalJson(geometryTarget(save.input).delta)
        )
          throw new Error('Uninterrupted movement replay is inconsistent.')
        return sceneGeometryCommandResultSchema.parse({ ...prior.result, replayed: true })
      }
      if (preparation?.outcome.kind === 'PENDING') {
        const intent = preparation.outcome.movementIntent
        const expectedDelta = intent ? { kind: 'TOKEN_MOVED' as const, ...intent } : null
        const replay = await rules.publishPreparedSpatialPending(ctx, input, null)
        if (
          prior.result.version !==
            save.snapshotVersion + (intent || save.fogSaves.length ? 1 : 0) ||
          checksumCanonicalJson(prior.result.delta) !== checksumCanonicalJson(expectedDelta) ||
          checksumCanonicalJson(prior.result.occurrence) !==
            checksumCanonicalJson(replay.retainedOccurrence)
        )
          throw new Error('Scene movement replay evidence is inconsistent.')
        return sceneGeometryCommandResultSchema.parse({
          ...prior.result,
          occurrence: replay.occurrence,
          replayed: true
        })
      }
      if (preparation?.outcome.kind !== 'TERMINAL')
        throw new Error('Spatial preparation is unavailable.')
      const retained = preparation.outcome.result
      const expectedDelta =
        retained.sceneVersion === save.snapshotVersion
          ? null
          : {
              kind: 'TOKEN_MOVED' as const,
              tokenId: retained.tokenId,
              position: retained.terminalPosition
            }
      if (
        prior.result.version !==
          Math.max(
            retained.sceneVersion,
            save.snapshotVersion + (save.fogSaves.length > 0 ? 1 : 0)
          ) ||
        checksumCanonicalJson(prior.result.delta) !== checksumCanonicalJson(expectedDelta)
      )
        throw new Error('Scene movement replay delta is inconsistent.')
      const replay = await rules.publishPreparedSpatialTerminal(ctx, save.id, {
        sceneTokens: [],
        actorIdByTokenId: new Map()
      })
      if (
        checksumCanonicalJson(replay.occurrence) !== checksumCanonicalJson(prior.result.occurrence)
      )
        throw new Error('Scene movement replay occurrence is inconsistent.')
    }
    return sceneGeometryCommandResultSchema.parse({
      ...prior.result,
      replayed: true
    })
  }
  assertGeometryReceiving(save, header.version, userId)
  await assertStandaloneMovement(ctx, header.campaignId, save.input)
  if (save.sessionVision) {
    if (!presented) throw new Error('Stored Scene geometry Session capture is missing.')
    await readSessionVisionScope(ctx, save.sessionVision, {
      campaign,
      header,
      userId,
      ...presented
    })
    if (!save.characterRevisions)
      throw new Error('Scene geometry Character observations are missing.')
    await assertSceneVisionCharacters(ctx, save.characterRevisions)
  } else if (save.characterRevisions) {
    throw new Error('Scene geometry Character observations require a Session context.')
  }
  const target = geometryTarget(save.input)
  const overrideRow = await ctx.db
    .query('sceneLiveEntities')
    .withIndex('by_sceneId_collection_entityId', (q) =>
      q.eq('sceneId', header.id).eq('collection', target.collection).eq('entityId', target.entityId)
    )
    .unique()
  const override = overrideRow ? parseLiveEntity(overrideRow, header.version) : null
  if (override && override.version > save.input.expectedSceneVersion)
    throw new Error('Scene target changed before this command completed.')
  let current = override?.value ?? null
  let ordinal = override?.ordinal ?? null
  let doorState = override?.doorState ?? null
  let oldExists = current !== null
  if (!override && input.baseOrdinal !== null) {
    const baseRow = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q
          .eq('saveId', header.definitionSaveId)
          .eq('value.collection', target.collection)
          .eq('ordinal', input.baseOrdinal!)
      )
      .unique()
    if (!baseRow) throw new Error('Scene geometry source is unavailable.')
    const base = sceneStoredDefinitionEntitySchema.parse(stored(baseRow))
    if (
      base.saveId !== header.definitionSaveId ||
      base.value.collection !== target.collection ||
      base.ordinal !== input.baseOrdinal ||
      base.ordinal >= header.counts[target.collection] ||
      base.checksum !== checksumCanonicalJson(base.value) ||
      base.entityId !== base.value.entity.id ||
      base.entityId.toLowerCase() !== target.entityId
    )
      throw new Error('Stored Scene geometry source is inconsistent.')
    if (base.value.collection === 'tokens') current = normalizeSceneGeometryEntity(base.value)
    else if (base.value.collection === 'barriers')
      current = normalizeSceneGeometryEntity(base.value)
    else throw new Error('Stored Scene geometry source is inconsistent.')
    ordinal = base.ordinal
    oldExists = true
    doorState =
      current.collection === 'barriers' && current.entity.kind === 'DOOR'
        ? current.entity.initialState
        : null
  }
  // The room admits a player's door change; the lock rule is the same as the GM tabletop's.
  if (save.input.type === 'SET_SCENE_DOOR_STATE' && membership.role !== 'OWNER') {
    const failure = sceneDoorChangeFailure(false, doorState ?? undefined, save.input.state)
    if (failure) throw new Error(failure)
  }
  if (!save.movementResolution && save.input.type === 'MOVE_SCENE_TOKEN') {
    const movingToken = current?.collection === 'tokens' ? current.entity : null
    if (bound && preparation) {
      if (!movingToken || movingToken.locked)
        throw new Error('Members may only move an unlocked token they control.')
      await requireBoundTokenMoveControl(encounterReadTransaction(ctx), {
        campaign,
        membership,
        encounterId: preparation.encounterId,
        tokenId: movingToken.id
      })
    } else assertMoveTokenControl(movingToken, userId, membership.role === 'OWNER')
  }
  const pending = preparation?.outcome.kind === 'PENDING' ? preparation.outcome : null
  const delta =
    save.input.type === 'MOVE_SCENE_TOKEN'
      ? preparedMovementSceneDelta({
          tokenId: save.input.tokenId,
          path: save.input.path,
          outcome: preparation?.outcome ?? null,
          sceneVersion: header.version
        })
      : target.delta
  const sceneChanged = delta !== null || save.fogSaves.length > 0
  let occurrence: SceneGeometryCommandResult['occurrence'] = null
  if (rules) {
    if (!input.tokenOrdinals) throw new Error('Spatial token source hints are missing.')
    const geometry = await readSpatialSceneGeometry(ctx, save.id, input.tokenOrdinals, currentSave)
    if (save.movementResolution) {
      occurrence = (await rules.publishPreparedMovementResponse(ctx, input, geometry)).occurrence
    } else if (preparation?.outcome.kind === 'UNINTERRUPTED') {
      await rules.verifyPreparedUninterruptedMovement(ctx, input, geometry)
    } else {
      const publication = pending
        ? await rules.publishPreparedSpatialPending(ctx, input, geometry)
        : await rules.publishPreparedSpatialTerminal(ctx, save.id, geometry, input)
      occurrence = publication.occurrence
    }
    // Each published segment of a voluntary move counts toward the actor's turn (D38).
    if (save.input.type === 'MOVE_SCENE_TOKEN' && save.input.movementKind === 'VOLUNTARY') {
      if (input.movementCost === undefined) throw new Error('Bound movement cost is missing.')
      const actorId = geometry.actorIdByTokenId.get(save.input.tokenId)
      // An uncalibrated SQUARES Scene has no feet to count.
      const feet = sceneLengthInFeet(input.movementCost, header.grid)
      if (actorId && feet !== null)
        await recordTurnMovement(encounterWriteTransaction(ctx), {
          state: geometry.encounter,
          actorId,
          feet
        })
    }
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
    delta ?? target.delta
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
  if (value && !oldExists) ordinal = state.nextOrdinals[target.collection]++
  if (!value) ordinal = null
  state.counts[target.collection] += (value ? 1 : 0) - (oldExists ? 1 : 0)
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
  if (delta) {
    if (overrideRow) await ctx.db.replace(overrideRow._id, change)
    else await ctx.db.insert('sceneLiveEntities', change)
  }
  const fogPatches = []
  for (const reference of save.fogSaves) {
    const childRow = await ctx.db
      .query('sceneFogSaves')
      .withIndex('by_publicId', (q) => q.eq('id', reference.saveId))
      .unique()
    if (!childRow) throw new Error('Stored geometry fog save is inconsistent.')
    const child = parseFogSave(childRow)
    if (
      child.geometrySaveId !== save.id ||
      child.sceneId !== save.sceneId ||
      child.actorUserId !== save.actorUserId ||
      child.input.layer.ownerUserId !== reference.ownerUserId ||
      child.status !== 'RECEIVING' ||
      child.chunksRemoved ||
      child.expiresAt <= Date.now() ||
      child.receivedChunks !== child.input.chunkManifest.length ||
      child.input.expectedSceneVersion !== save.snapshotVersion
    )
      throw new Error('Stored geometry fog save is inconsistent.')
    const publication = await publishFogLayer(ctx, child, header, state)
    fogPatches.push({ ...publication.patch, mode: 'REPLACE' as const })
    await ctx.db.patch(childRow._id, {
      status: 'PUBLISHED',
      ...(save.input.type === 'MOVE_SCENE_TOKEN'
        ? { previousLayer: publication.previousLayer }
        : {})
    })
  }
  sceneStoredLiveStateSchema.parse(state)
  const result = sceneGeometryCommandResultSchema.parse({
    sceneId: header.id,
    commandId: save.commandId,
    version: sceneChanged ? state.version : header.version,
    occurrence,
    replayed: false,
    delta,
    fogPatches
  })
  if (sceneChanged) {
    if (liveRow) await ctx.db.replace(liveRow._id, state)
    else await ctx.db.insert('sceneLiveStates', state)
  }
  await ctx.db.patch(saveRow._id, { status: 'PUBLISHED' })
  await ctx.db.insert(
    'sceneLiveCommands',
    sceneStoredGeometryCommandSchema.parse({
      encoding: 'GEOMETRY',
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
