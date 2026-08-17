import { createHash, randomUUID } from 'node:crypto'

import {
  createEncounterRepository,
  createVttSceneRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import type {
  AttachEncounterSceneInputDto,
  AttachEncounterSceneResultDto,
  CreateSceneDefinitionInputDto,
  DeleteSceneDefinitionInputDto,
  SceneCommandInputDto,
  SceneCommandResultDto,
  SceneDefinitionDto,
  UpdateSceneDefinitionInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { LiveSessionSceneVisionContextDto } from '@artificer-toolkit/schema/api/liveSessions'
import {
  applySceneEvent,
  canMoveBetween,
  deriveSceneExplorationPatch,
  deriveSceneTokenPathExplorationPatch,
  replaySceneEvents,
  sceneTokenIdsAffectedByBarriers,
  materializeEncounterScene,
  projectSceneForViewer,
  resolveSceneCharacterVision,
  sceneDeltaConflictKeys,
  SceneBarrierIndex,
  type EncounterSceneState,
  type SceneAtomicDelta,
  type SceneDelta,
  type SceneEvent
} from '@artificer-toolkit/shared/vtt'

import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  resolveCampaignAuthority,
  CampaignConflictError
} from '../campaign/campaignService.js'
import {
  assertSessionLiveSessionCommandAuthority,
  type LiveSessionCommandAuthority
} from '../campaign/liveSessionCommandAuthority.js'
import {
  EncounterConflictError,
  EncounterNotFoundError,
  EncounterValidationError
} from './encounterErrors.js'

interface LiveSceneOptions {
  sceneVisionContext?: LiveSessionSceneVisionContextDto
  liveSessionAuthority?: LiveSessionCommandAuthority
}

function fingerprint(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

function commandToDelta(input: SceneCommandInputDto): SceneAtomicDelta {
  switch (input.type) {
    case 'UPSERT_SCENE_TOKEN':
      return { kind: 'TOKEN_UPSERTED', token: input.token }
    case 'REMOVE_SCENE_TOKEN':
      return { kind: 'TOKEN_REMOVED', tokenId: input.tokenId }
    case 'MOVE_SCENE_TOKEN':
      return { kind: 'TOKEN_MOVED', position: input.path.at(-1)!, tokenId: input.tokenId }
    case 'SET_SCENE_DOOR_STATE':
      return { kind: 'DOOR_STATE_SET', barrierId: input.barrierId, state: input.state }
    case 'UPSERT_SCENE_BARRIER':
      return { kind: 'BARRIER_UPSERTED', barrier: input.barrier }
    case 'REMOVE_SCENE_BARRIER':
      return { kind: 'BARRIER_REMOVED', barrierId: input.barrierId }
    case 'UPSERT_SCENE_LIGHT':
      return { kind: 'LIGHT_UPSERTED', light: input.light }
    case 'REMOVE_SCENE_LIGHT':
      return { kind: 'LIGHT_REMOVED', lightId: input.lightId }
    case 'UPSERT_SCENE_DARKNESS':
      return { kind: 'DARKNESS_UPSERTED', zone: input.zone }
    case 'REMOVE_SCENE_DARKNESS':
      return { kind: 'DARKNESS_REMOVED', zoneId: input.zoneId }
    case 'UPSERT_SCENE_ANNOTATION':
      return { kind: 'ANNOTATION_UPSERTED', annotation: input.annotation }
    case 'REMOVE_SCENE_ANNOTATION':
      return { kind: 'ANNOTATION_REMOVED', annotationId: input.annotationId }
    case 'PATCH_SCENE_FOG':
      return { kind: 'FOG_CHUNKS_PATCHED', layer: input.layer }
    case 'SET_SCENE_VISION_REVEAL_MODE':
      return { kind: 'VISION_REVEAL_MODE_SET', mode: input.mode }
    case 'UPSERT_SCENE_MEASUREMENT':
      return { kind: 'MEASUREMENT_UPSERTED', measurement: input.measurement }
    case 'REMOVE_SCENE_MEASUREMENT':
      return { kind: 'MEASUREMENT_REMOVED', measurementId: input.measurementId }
    case 'UNDO_LAST_SCENE_MOVE':
      throw new EncounterValidationError('Undo must be resolved from the persisted scene history.')
  }
}

function atomicDeltas(delta: SceneDelta): readonly SceneAtomicDelta[] {
  return delta.kind === 'BATCH' ? delta.deltas : [delta]
}

function createUndoLastMoveDelta(
  state: EncounterSceneState,
  definition: Parameters<typeof replaySceneEvents>[0],
  history: readonly { commandType: string; event: SceneEvent }[]
): SceneDelta {
  const undoneCommandIds = new Set(
    history.flatMap(({ event }) =>
      atomicDeltas(event.delta).flatMap((delta) =>
        delta.kind === 'TOKEN_MOVE_UNDONE' ? [delta.undoneCommandId] : []
      )
    )
  )
  let targetIndex = -1
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const candidate = history[index]
    if (
      candidate?.commandType === 'MOVE_SCENE_TOKEN' &&
      !undoneCommandIds.has(candidate.event.commandId)
    ) {
      targetIndex = index
      break
    }
  }
  if (targetIndex < 0) {
    throw new EncounterValidationError('There is no committed token move to undo.')
  }
  const target = history[targetIndex]!
  const movement = atomicDeltas(target.event.delta).find(
    (delta): delta is Extract<SceneAtomicDelta, { kind: 'TOKEN_MOVED' }> =>
      delta.kind === 'TOKEN_MOVED'
  )
  if (!movement) {
    throw new EncounterValidationError('The latest token move has no movement delta.')
  }
  const targetKeys = new Set(sceneDeltaConflictKeys(target.event.delta))
  const laterConflict = history
    .slice(targetIndex + 1)
    .some(({ event }) => sceneDeltaConflictKeys(event.delta).some((key) => targetKeys.has(key)))
  if (laterConflict) {
    throw new EncounterConflictError('The latest token move can no longer be safely undone.')
  }
  const prior = replaySceneEvents(
    definition,
    state.encounterId,
    state.id,
    history.slice(0, targetIndex).map(({ event }) => event)
  )
  const priorToken = prior.tokens.find((token) => token.id === movement.tokenId)
  if (!priorToken) {
    throw new EncounterValidationError('The moved token did not exist before that move.')
  }
  const deltas: SceneAtomicDelta[] = [
    {
      kind: 'TOKEN_MOVE_UNDONE',
      position: structuredClone(priorToken.position),
      tokenId: movement.tokenId,
      undoneCommandId: target.event.commandId
    }
  ]
  const fogOwners = new Set(
    atomicDeltas(target.event.delta).flatMap((delta) =>
      delta.kind === 'FOG_CHUNKS_PATCHED' ? [delta.layer.ownerUserId] : []
    )
  )
  for (const ownerUserId of fogOwners) {
    const layer = prior.fogLayers.find((candidate) => candidate.ownerUserId === ownerUserId) ?? null
    deltas.push({
      kind: 'FOG_LAYER_REPLACED',
      layer: layer ? structuredClone(layer) : null,
      ownerUserId
    })
  }
  return deltas.length === 1 ? deltas[0]! : { deltas, kind: 'BATCH' }
}

function assertSceneCommandVersion(
  currentVersion: number,
  expectedVersion: number,
  delta: SceneDelta,
  laterDeltas: readonly SceneDelta[]
): void {
  if (expectedVersion > currentVersion) {
    throw new EncounterConflictError('Scene version is ahead of the authoritative state.')
  }
  const requestedKeys = new Set(sceneDeltaConflictKeys(delta))
  if (
    expectedVersion < currentVersion &&
    laterDeltas.some((laterDelta) =>
      sceneDeltaConflictKeys(laterDelta).some((laterKey) => requestedKeys.has(laterKey))
    )
  ) {
    throw new EncounterConflictError('Scene target changed before this command completed.')
  }
}

function assertPointWithinMap(state: EncounterSceneState, point: { x: number; y: number }): void {
  if (point.x < 0 || point.y < 0 || point.x > state.map.width || point.y > state.map.height) {
    throw new EncounterValidationError('Token movement must remain within the map bounds.')
  }
}

function assertTokenMovement(
  state: EncounterSceneState,
  delta: Extract<SceneAtomicDelta, { kind: 'TOKEN_MOVED' }>,
  path: readonly { x: number; y: number }[]
): void {
  const token = state.tokens.find((candidate) => candidate.id === delta.tokenId)
  if (!token || token.locked) {
    throw new EncounterValidationError('The token is missing or locked.')
  }
  const first = path[0]
  const last = path.at(-1)
  if (
    !first ||
    !last ||
    first.x !== token.position.x ||
    first.y !== token.position.y ||
    last.x !== delta.position.x ||
    last.y !== delta.position.y
  ) {
    throw new EncounterValidationError(
      'Token movement must follow a path from its current position.'
    )
  }
  for (const point of path) assertPointWithinMap(state, point)
  const index = new SceneBarrierIndex(state.barriers)
  for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
    if (!canMoveBetween(state, path[pathIndex - 1]!, path[pathIndex]!, index)) {
      throw new EncounterValidationError('Token movement crosses a blocking barrier.')
    }
  }
}

function assertPlayerCommand(
  state: EncounterSceneState,
  userId: string,
  delta: SceneDelta,
  movementPath?: readonly { x: number; y: number }[]
): void {
  switch (delta.kind) {
    case 'TOKEN_MOVED': {
      const token = state.tokens.find((candidate) => candidate.id === delta.tokenId)
      if (!token || token.locked || !token.controlledByUserIds.includes(userId)) {
        throw new EncounterValidationError('Players may only move an unlocked token they control.')
      }
      assertTokenMovement(state, delta, movementPath ?? [token.position, delta.position])
      return
    }
    case 'DOOR_STATE_SET': {
      const door = state.barriers.find(
        (barrier) => barrier.id === delta.barrierId && barrier.kind === 'DOOR'
      )
      const currentState = state.doorStates[delta.barrierId]
      if (!door || currentState === 'LOCKED' || delta.state === 'LOCKED') {
        throw new EncounterValidationError(
          'Players cannot operate locked doors or change door locks.'
        )
      }
      return
    }
    case 'MEASUREMENT_UPSERTED':
      if (delta.measurement.createdByUserId !== userId) {
        throw new EncounterValidationError('Players may only save their own measurements.')
      }
      return
    case 'MEASUREMENT_REMOVED': {
      const measurement = state.measurements.find(
        (candidate) => candidate.id === delta.measurementId
      )
      if (!measurement || measurement.createdByUserId !== userId) {
        throw new EncounterValidationError('Players may only remove their own measurements.')
      }
      return
    }
    default:
      throw new EncounterValidationError('Only the Campaign owner can make this scene change.')
  }
}

function explorationDeltasFor(
  priorState: EncounterSceneState,
  state: EncounterSceneState,
  delta: SceneAtomicDelta,
  sceneVisionContext?: LiveSessionSceneVisionContextDto,
  movementPath?: readonly { x: number; y: number }[]
): SceneAtomicDelta[] {
  const resolvedState = sceneVisionContext
    ? resolveSceneCharacterVision(
        state,
        sceneVisionContext.encounterCharacterBindings,
        sceneVisionContext.characterVisions
      )
    : state
  const affectedBarriers =
    delta.kind === 'DOOR_STATE_SET'
      ? state.barriers.filter((barrier) => barrier.id === delta.barrierId)
      : delta.kind === 'BARRIER_UPSERTED'
        ? [
            ...priorState.barriers.filter((barrier) => barrier.id === delta.barrier.id),
            delta.barrier
          ]
        : delta.kind === 'BARRIER_REMOVED'
          ? priorState.barriers.filter((barrier) => barrier.id === delta.barrierId)
          : []
  const tokenIds =
    delta.kind === 'TOKEN_MOVED'
      ? [delta.tokenId]
      : delta.kind === 'TOKEN_UPSERTED'
        ? [delta.token.id]
        : delta.kind === 'DOOR_STATE_SET' ||
            delta.kind === 'BARRIER_UPSERTED' ||
            delta.kind === 'BARRIER_REMOVED'
          ? sceneTokenIdsAffectedByBarriers(resolvedState, affectedBarriers)
          : null
  if (tokenIds === null || tokenIds.length === 0) return []
  const owners =
    resolvedState.fogMode === 'SHARED_PARTY'
      ? [null]
      : [
          ...new Set(
            resolvedState.tokens
              .filter((token) => tokenIds.includes(token.id))
              .flatMap((token) => token.controlledByUserIds)
          )
        ]
  return owners.flatMap((ownerUserId) => {
    const layer =
      delta.kind === 'TOKEN_MOVED' && movementPath
        ? deriveSceneTokenPathExplorationPatch(resolvedState, {
            ownerUserId,
            path: movementPath,
            tokenId: delta.tokenId
          })
        : deriveSceneExplorationPatch(resolvedState, {
            ownerUserId,
            tokenIds
          })
    return layer ? [{ kind: 'FOG_CHUNKS_PATCHED' as const, layer }] : []
  })
}

async function requireEncounter(
  db: DBLike,
  encounterId: string,
  userId: string,
  options: LiveSceneOptions,
  write: boolean
) {
  const encounter = await createEncounterRepository(db).find(encounterId)
  if (!encounter) throw new EncounterNotFoundError()
  const authority = await resolveCampaignAuthority(db, encounter.campaignId, userId)
  assertActiveCampaignMember(authority)
  if (write) assertCampaignWritable(authority)
  return { authority, encounter }
}

export async function createCampaignSceneDefinition(
  db: DBLike,
  userId: string,
  input: CreateSceneDefinitionInputDto
): Promise<SceneDefinitionDto> {
  return withTransaction(db, async (trx) => {
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const definition = {
      ...input,
      id: randomUUID(),
      version: 1
    }
    return createVttSceneRepository(trx)
      .createDefinition(definition)
      .then((record) => record.definition)
  })
}

export async function listCampaignSceneDefinitions(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<SceneDefinitionDto[]> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertCampaignOwner(authority)
  return createVttSceneRepository(db)
    .listDefinitions(campaignId)
    .then((rows) => rows.map((row) => row.definition))
}

export async function getCampaignSceneDefinition(
  db: DBLike,
  userId: string,
  input: { campaignId: string; sceneId: string }
): Promise<SceneDefinitionDto> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertCampaignOwner(authority)
  const definition = await createVttSceneRepository(db).findDefinition(
    input.campaignId,
    input.sceneId
  )
  if (!definition) throw new EncounterValidationError('Campaign scene definition was not found.')
  return definition.definition
}

export async function updateCampaignSceneDefinition(
  db: DBLike,
  userId: string,
  input: UpdateSceneDefinitionInputDto
): Promise<SceneDefinitionDto> {
  return withTransaction(db, async (trx) => {
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const repository = createVttSceneRepository(trx)
    const existing = await repository.findDefinition(input.campaignId, input.sceneId)
    if (!existing) throw new EncounterValidationError('Campaign scene definition was not found.')
    if (existing.definition.version !== input.expectedVersion) {
      throw new CampaignConflictError('Campaign scene definition version is stale.')
    }
    const { expectedVersion, sceneId, ...definitionInput } = input
    const saved = await repository.updateDefinition(
      { ...definitionInput, id: sceneId, version: expectedVersion + 1 },
      expectedVersion
    )
    if (!saved) throw new CampaignConflictError('Campaign scene definition version is stale.')
    return saved.definition
  })
}

export async function deleteCampaignSceneDefinition(
  db: DBLike,
  userId: string,
  input: DeleteSceneDefinitionInputDto
): Promise<void> {
  await withTransaction(db, async (trx) => {
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const repository = createVttSceneRepository(trx)
    const existing = await repository.findDefinition(input.campaignId, input.sceneId)
    if (!existing) throw new EncounterValidationError('Campaign scene definition was not found.')
    if (existing.definition.version !== input.expectedVersion) {
      throw new CampaignConflictError('Campaign scene definition version is stale.')
    }
    if (
      !(await repository.deleteDefinition(input.campaignId, input.sceneId, input.expectedVersion))
    ) {
      throw new CampaignConflictError('Campaign scene definition changed before deletion.')
    }
  })
}

export async function attachEncounterScene(
  db: DBLike,
  userId: string,
  input: AttachEncounterSceneInputDto,
  options: LiveSceneOptions = {}
): Promise<AttachEncounterSceneResultDto> {
  return withTransaction(db, async (trx) => {
    const { authority, encounter } = await requireEncounter(
      trx,
      input.encounterId,
      userId,
      options,
      true
    )
    assertCampaignOwner(authority)
    await assertSessionLiveSessionCommandAuthority(
      trx,
      encounter.sessionId,
      options.liveSessionAuthority
    )
    const repository = createVttSceneRepository(trx)
    const commandFingerprint = fingerprint(input)
    const existing = await repository.lockByEncounter(encounter.id)
    if (existing) {
      if (
        existing.attachCommandId !== input.commandId ||
        existing.attachCommandFingerprint !== commandFingerprint
      ) {
        throw new EncounterConflictError('An Encounter can only have one attached scene.')
      }
      return { replayed: true, scene: existing.state }
    }
    const definition = await repository.findDefinition(
      encounter.campaignId,
      input.sceneDefinitionId
    )
    if (!definition) throw new EncounterValidationError('Campaign scene definition was not found.')
    const state = materializeEncounterScene(definition.definition, encounter.id, randomUUID())
    const created = await repository.createEncounterScene({
      attachCommandFingerprint: commandFingerprint,
      attachCommandId: input.commandId,
      definitionSnapshot: definition.definition,
      state
    })
    return { replayed: false, scene: created.state }
  })
}

export async function getEncounterSceneProjection(
  db: DBLike,
  userId: string,
  input: { encounterId: string }
): Promise<EncounterSceneState> {
  const { authority, encounter } = await requireEncounter(db, input.encounterId, userId, {}, false)
  const scene = await createVttSceneRepository(db).findByEncounter(encounter.id)
  if (!scene) throw new EncounterValidationError('Encounter scene was not found.')
  return projectSceneForViewer(scene.state, {
    role: authority.membership.role === 'OWNER' ? 'GM' : 'PLAYER',
    userId
  })
}

export async function executeEncounterSceneCommandWithState(
  db: DBLike,
  userId: string,
  input: SceneCommandInputDto,
  options: LiveSceneOptions = {}
): Promise<{ result: SceneCommandResultDto; state: EncounterSceneState }> {
  return withTransaction(db, async (trx) => {
    const { authority, encounter } = await requireEncounter(
      trx,
      input.encounterId,
      userId,
      options,
      true
    )
    await assertSessionLiveSessionCommandAuthority(
      trx,
      encounter.sessionId,
      options.liveSessionAuthority
    )
    const repository = createVttSceneRepository(trx)
    const commandFingerprint = fingerprint(input)
    const scene = await repository.lockByEncounter(encounter.id)
    if (!scene || scene.state.id !== input.sceneId) {
      throw new EncounterValidationError('Encounter scene was not found.')
    }
    const prior = await repository.findEventByCommand(encounter.id, input.commandId)
    if (prior) {
      if (prior.commandFingerprint !== commandFingerprint || prior.commandType !== input.type) {
        throw new EncounterConflictError('Command ID was already used with different input.')
      }
      return {
        result: {
          commandId: prior.event.commandId,
          delta: prior.event.delta,
          replayed: true,
          sceneId: prior.event.sceneId,
          version: prior.event.version
        },
        state: scene.state
      }
    }
    let delta: SceneDelta
    if (input.type === 'UNDO_LAST_SCENE_MOVE') {
      if (authority.membership.role !== 'OWNER') {
        throw new EncounterValidationError('Only the Campaign owner can undo a token move.')
      }
      if (input.expectedSceneVersion !== scene.state.version) {
        throw new EncounterConflictError('Scene changed before the move could be undone.')
      }
      delta = createUndoLastMoveDelta(
        scene.state,
        scene.definitionSnapshot,
        await repository.listEvents(scene.state.id)
      )
    } else {
      const primaryDelta = commandToDelta(input)
      if (authority.membership.role !== 'OWNER') {
        assertPlayerCommand(
          scene.state,
          userId,
          primaryDelta,
          input.type === 'MOVE_SCENE_TOKEN' ? input.path : undefined
        )
      } else if (primaryDelta.kind === 'TOKEN_MOVED') {
        assertTokenMovement(
          scene.state,
          primaryDelta,
          input.type === 'MOVE_SCENE_TOKEN' ? input.path : []
        )
      }
      const laterDeltas =
        input.expectedSceneVersion < scene.state.version
          ? (await repository.listEventsAfter(scene.state.id, input.expectedSceneVersion)).map(
              (event) => event.event.delta
            )
          : []
      assertSceneCommandVersion(
        scene.state.version,
        input.expectedSceneVersion,
        primaryDelta,
        laterDeltas
      )
      const stateAfterPrimary = applySceneEvent(scene.state, {
        actorUserId: userId,
        commandId: input.commandId,
        delta: primaryDelta,
        sceneId: scene.state.id,
        version: scene.state.version + 1
      })
      const explorationDeltas = explorationDeltasFor(
        scene.state,
        stateAfterPrimary,
        primaryDelta,
        options.sceneVisionContext,
        input.type === 'MOVE_SCENE_TOKEN' ? input.path : undefined
      )
      delta =
        explorationDeltas.length === 0
          ? primaryDelta
          : { deltas: [primaryDelta, ...explorationDeltas], kind: 'BATCH' }
    }
    const event = {
      actorUserId: userId,
      commandId: input.commandId,
      delta,
      sceneId: scene.state.id,
      version: scene.state.version + 1
    }
    const nextState = applySceneEvent(scene.state, event)
    await repository.appendEvent({
      commandFingerprint,
      commandType: input.type,
      encounterId: encounter.id,
      event,
      id: randomUUID()
    })
    if (!(await repository.updateProjection(nextState, scene.state.version))) {
      throw new EncounterConflictError('Scene changed before this command completed.')
    }
    return {
      result: {
        commandId: event.commandId,
        delta: event.delta,
        replayed: false,
        sceneId: event.sceneId,
        version: event.version
      },
      state: nextState
    }
  })
}

export async function executeEncounterSceneCommand(
  db: DBLike,
  userId: string,
  input: SceneCommandInputDto,
  options: LiveSceneOptions = {}
): Promise<SceneCommandResultDto> {
  return (await executeEncounterSceneCommandWithState(db, userId, input, options)).result
}

export const vttSceneServiceInternals = {
  assertPlayerCommand,
  assertSceneCommandVersion,
  commandToDelta,
  createUndoLastMoveDelta,
  explorationDeltasFor
}
