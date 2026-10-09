import type { EncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import {
  sceneGeometryFinishInputSchema,
  sceneGeometryCommandResultSchema,
  type SceneGeometryEntity,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneFogCommandResult } from '@artificer-toolkit/schema/api/sceneFog'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import type { SceneSessionVisionScope } from '@artificer-toolkit/schema/api/sceneSessionVision'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneStoredGeometrySave } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import {
  sceneStoredGeometryCommandSchema,
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema,
  type sceneStoredLiveCommandSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  applySceneGeometryDelta,
  sceneDoorChangeFailure,
  sceneLengthInFeet
} from '@artificer-toolkit/shared/vtt'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { preparedMovementSceneDelta } from '@artificer-toolkit/rules-runtime/encounterMovementPublication'
import {
  parseGeometryCommand,
  assertGeometryReceiving,
  readSpatialPreparation
} from './sceneGeometryDocuments.js'
import { geometryTarget, normalizeSceneGeometryEntity } from './sceneGeometryValues.js'
import { advanceLiveState } from './sceneLiveState.js'
import { requireBoundTokenMoveControl } from './actorController.js'
import { recordTurnMovement } from './turnMovement.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

type SceneGeometryFinishInput = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
type MovementPresentation = { campaignId: string; sceneId: string | null; version: number }

export type SceneGeometrySaveContext = {
  save: SceneStoredGeometrySave
  header: SceneLiveStateHeader
  campaign: EncounterDocument<'campaigns'>
  membership: EncounterDocument<'campaignMemberships'>
  userId: string
  live: ReturnType<typeof sceneStoredLiveStateSchema.parse> | null
  presented: { presentation: MovementPresentation } | null
}

type SpatialSceneGeometry = {
  sceneTokens: readonly SceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
  encounter: EncounterRunState
  saveContext: SceneGeometrySaveContext
}
type SpatialTerminalGeometry<TGeometry extends SpatialSceneGeometry> =
  | Pick<TGeometry, 'sceneTokens' | 'actorIdByTokenId'>
  | { sceneTokens: SceneToken[]; actorIdByTokenId: Map<string, string> }

type SceneGeometryPublication<TGeometry extends SpatialSceneGeometry> = {
  publishPreparedMovementResponse: (
    request: SceneGeometryFinishInput,
    geometry: SpatialTerminalGeometry<TGeometry> | null
  ) => Promise<{ occurrence: EncounterRuleOccurrenceSummaryDto }>
  publishPreparedSpatialPending: (
    request: SceneGeometryFinishInput,
    geometry: TGeometry | null
  ) => Promise<{
    occurrence: SceneGeometryCommandResult['occurrence']
    retainedOccurrence: SceneGeometryCommandResult['occurrence']
  }>
  publishPreparedSpatialTerminal: (
    saveId: string,
    geometry: SpatialTerminalGeometry<TGeometry>,
    request?: SceneGeometryFinishInput
  ) => Promise<{ occurrence: SceneGeometryCommandResult['occurrence'] }>
  verifyPreparedUninterruptedMovement: (
    request: SceneGeometryFinishInput,
    geometry: SpatialTerminalGeometry<TGeometry>
  ) => Promise<void>
}

export type SceneGeometryPublicationCallbacks<TGeometry extends SpatialSceneGeometry> = {
  readGeometrySave(saveId: string): Promise<SceneGeometrySaveContext>
  readSceneCommand(
    sceneId: string,
    commandId: string
  ): Promise<ReturnType<typeof sceneStoredLiveCommandSchema.parse> | null>
  readLiveEntity(
    sceneId: string,
    collection: 'tokens' | 'barriers',
    entityId: string
  ): Promise<ReturnType<typeof sceneStoredLiveEntitySchema.parse> | null>
  readDefinitionEntity(
    saveId: string,
    collection: 'tokens' | 'barriers',
    ordinal: number
  ): Promise<ReturnType<typeof sceneStoredDefinitionEntitySchema.parse> | null>
  assertStandaloneMovement(
    campaignId: string,
    input: SceneStoredGeometrySave['input']
  ): Promise<void>
  readSessionVisionScope(
    scope: SceneSessionVisionScope,
    current: {
      header: SceneLiveStateHeader
      campaign: EncounterDocument<'campaigns'>
      userId: string
      presentation: MovementPresentation
    }
  ): Promise<unknown>
  assertSceneVisionCharacters(
    revisions: NonNullable<SceneStoredGeometrySave['characterRevisions']>
  ): Promise<void>
  readSpatialSceneGeometry(
    saveId: string,
    hints: NonNullable<SceneGeometryFinishInput['tokenOrdinals']>,
    currentSave: SceneGeometrySaveContext
  ): Promise<TGeometry>
  writeLiveEntity(value: ReturnType<typeof sceneStoredLiveEntitySchema.parse>): Promise<void>
  writeLiveState(value: ReturnType<typeof sceneStoredLiveStateSchema.parse>): Promise<void>
  publishFog(
    reference: SceneStoredGeometrySave['fogSaves'][number],
    save: SceneStoredGeometrySave,
    header: SceneLiveStateHeader,
    state: ReturnType<typeof sceneStoredLiveStateSchema.parse>
  ): Promise<SceneFogCommandResult['patch']>
  markGeometryPublished(saveId: string): Promise<void>
  insertSceneCommand(
    value: ReturnType<typeof sceneStoredGeometryCommandSchema.parse>
  ): Promise<void>
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
export async function publishSceneGeometry<TGeometry extends SpatialSceneGeometry>(
  ctx: EncounterCharacterWriteTransaction,
  args: SceneGeometryFinishInput,
  rules: SceneGeometryPublication<TGeometry> | null,
  callbacks: SceneGeometryPublicationCallbacks<TGeometry>,
  previouslyRead?: SceneGeometrySaveContext
): Promise<SceneGeometryCommandResult> {
  const input = sceneGeometryFinishInputSchema.parse(args)
  const currentSave =
    previouslyRead ?? (await callbacks.readGeometrySave(input.saveId.toLowerCase()))
  if (currentSave.save.id !== input.saveId.toLowerCase())
    throw new Error('Stored Scene geometry save is inconsistent.')
  const { save, header, campaign, membership, userId, live, presented } = currentSave
  const preparation = readSpatialPreparation(save)
  const bound =
    save.input.type === 'MOVE_SCENE_TOKEN' && save.input.expectedEncounterVersion !== null
  if (bound !== (rules !== null) || (bound && !preparation))
    throw new Error('Only the Session room publishes Encounter-bound movement, with its rules.')
  const priorRow = await callbacks.readSceneCommand(header.id, save.commandId)
  if (priorRow) {
    if (priorRow.encoding !== 'GEOMETRY') throw new Error('Scene command ID was already used.')
    const prior = parseGeometryCommand(priorRow, header.version)
    if (prior.inputChecksum !== save.inputChecksum)
      throw new Error('Scene command ID was already used.')
    if (save.movementResolution && rules) {
      const replay = await rules.publishPreparedMovementResponse(input, null)
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
        const replay = await rules.publishPreparedSpatialPending(input, null)
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
      const replay = await rules.publishPreparedSpatialTerminal(save.id, {
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
  await callbacks.assertStandaloneMovement(header.campaignId, save.input)
  if (save.sessionVision) {
    if (!presented) throw new Error('Stored Scene geometry Session capture is missing.')
    await callbacks.readSessionVisionScope(save.sessionVision, {
      campaign,
      header,
      userId,
      ...presented
    })
    if (!save.characterRevisions)
      throw new Error('Scene geometry Character observations are missing.')
    await callbacks.assertSceneVisionCharacters(save.characterRevisions)
  } else if (save.characterRevisions) {
    throw new Error('Scene geometry Character observations require a Session context.')
  }
  const target = geometryTarget(save.input)
  const override = await callbacks.readLiveEntity(header.id, target.collection, target.entityId)
  if (override && override.version > save.input.expectedSceneVersion)
    throw new Error('Scene target changed before this command completed.')
  let current = override?.value ?? null
  let ordinal = override?.ordinal ?? null
  let doorState = override?.doorState ?? null
  let oldExists = current !== null
  if (!override && input.baseOrdinal !== null) {
    const baseRow = await callbacks.readDefinitionEntity(
      header.definitionSaveId,
      target.collection,
      input.baseOrdinal
    )
    if (!baseRow) throw new Error('Scene geometry source is unavailable.')
    const base = sceneStoredDefinitionEntitySchema.parse(baseRow)
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
      await requireBoundTokenMoveControl(ctx, {
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
    const geometry = await callbacks.readSpatialSceneGeometry(
      save.id,
      input.tokenOrdinals,
      currentSave
    )
    if (save.movementResolution) {
      occurrence = (await rules.publishPreparedMovementResponse(input, geometry)).occurrence
    } else if (preparation?.outcome.kind === 'UNINTERRUPTED') {
      await rules.verifyPreparedUninterruptedMovement(input, geometry)
    } else {
      const publication = pending
        ? await rules.publishPreparedSpatialPending(input, geometry)
        : await rules.publishPreparedSpatialTerminal(save.id, geometry, input)
      occurrence = publication.occurrence
    }
    // Each published segment of a voluntary move counts toward the actor's turn (D38).
    if (save.input.type === 'MOVE_SCENE_TOKEN' && save.input.movementKind === 'VOLUNTARY') {
      if (input.movementCost === undefined) throw new Error('Bound movement cost is missing.')
      const speedId = save.input.speedId ?? null
      if (
        speedId !== null &&
        !(await ctx.ports.requireSystem(campaign.gameSystemId)).speeds.some(
          ({ id }) => id === speedId
        )
      )
        throw new Error('Movement names an unknown speed type.')
      const actorId = geometry.actorIdByTokenId.get(save.input.tokenId)
      // An uncalibrated SQUARES Scene has no feet to count.
      const feet = sceneLengthInFeet(input.movementCost, header.grid)
      if (actorId && feet !== null)
        await recordTurnMovement(ctx, {
          state: geometry.encounter,
          actorId,
          feet,
          speedId
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
  if (delta) await callbacks.writeLiveEntity(change)
  const fogPatches = []
  for (const reference of save.fogSaves) {
    const patch = await callbacks.publishFog(reference, save, header, state)
    fogPatches.push({ ...patch, mode: 'REPLACE' as const })
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
  if (sceneChanged) await callbacks.writeLiveState(state)
  await callbacks.markGeometryPublished(save.id)
  await callbacks.insertSceneCommand(
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
