import { createHash, randomUUID } from 'node:crypto'

import {
  createCampaignRepository,
  createEncounterRepository,
  createReusableDefinitionRepository,
  createRuleOccurrenceRepository,
  createSpatialRuleEffectRepository,
  createSystemVocabularySnapshotRepository,
  createVttSceneRepository,
  checksumCanonicalJson,
  withTransaction,
  type DBLike,
  type CampaignLiveSceneRecord,
  type Json,
  type RuleOccurrenceReceipt,
  type RuleOccurrenceRecord
} from '@artificer-toolkit/db'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import type {
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto,
  CampaignLiveSceneSummaryDto,
  RemoveEncounterSceneActorTokenBindingInputDto,
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto,
  SetEncounterSceneActorTokenBindingInputDto,
  CreateSceneDefinitionInputDto,
  DeleteSceneDefinitionInputDto,
  SceneCommandInputDto,
  SceneCommandResultDto,
  SceneDefinitionDto,
  UpdateSceneDefinitionInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND,
  setCampaignLiveScenePresentationInputDtoSchema,
  setCampaignLiveScenePresentationResultDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import type { LiveSessionSceneVisionContextDto } from '@artificer-toolkit/schema/api/liveSessions'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterProjectionEventSchema } from '@artificer-toolkit/schema/projections/encounter'
import type { MovementReactionTimelineDto } from '@artificer-toolkit/schema/shared/reaction'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  storedRuleExecutionResultDtoSchema
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  applySceneEvent,
  canMoveBetween,
  deriveSceneExplorationPatch,
  deriveSceneTokenPathExplorationPatch,
  sceneTokenIdsAffectedByBarriers,
  materializeCampaignScene,
  projectSceneForViewer,
  resolveSceneCharacterVision,
  sceneDeltaConflictKeys,
  SceneBarrierIndex,
  type CampaignSceneState,
  type SceneAtomicDelta,
  type SceneDelta,
  type SceneDefinition,
  type SceneEvent
} from '@artificer-toolkit/shared/vtt'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  CampaignAccessError,
  CampaignConflictError,
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  resolveCampaignAuthority
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
import { evaluateEncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'
import { lockEncounterRuleExecutionCommandContext } from './encounterRuleExecutionCommandContext.js'
import {
  evaluateEncounterSpatialMovementRuleBatch,
  type SpatialMovementRuleRoot
} from './encounterSpatialMovementRuleService.js'
import { compileEncounterCurrentProjection, projectGm } from './encounterProjection.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  compileSceneCurrentProjection,
  replayCampaignSceneProjection
} from './sceneProjectionReplay.js'
import { projectEncounterSpatialOccurrenceSummary } from './encounterSpatialOccurrenceSummary.js'
import {
  lockEncounterActiveEffectTargets,
  refreshLockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import { discoverEncounterMovementReactionChoices } from './encounterMovementReactionDiscovery.js'
import {
  startEncounterAutomaticMovementReactionEvidenceAtBoundary,
  startEncounterMovementReactionAtBoundary
} from './encounterMovementReactionContinuation.js'
import { executeAutomaticEncounterMovementReaction } from './encounterAutomaticMovementReaction.js'
import { discoverEncounterFeatureActionCapabilities } from '../rules/encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { createMovementReactionChoiceDefinition } from '../rules/movementReactionChoice.js'
import { encounterSceneGridPolicyRegistry } from '../rules/sceneGridPolicyRegistry.js'
import { lockEncounterMovementReactionPerceptionResolver } from './encounterMovementReactionPerception.js'
import {
  movementCommandCharacterAggregateVersions,
  terminalMovementChangedAggregates,
  type MovementCommandTransition,
  type MovementChangedAggregate
} from './encounterMovementChangedAggregates.js'
import { discoverEncounterMovementPassageContact } from './encounterMovementPassageContacts.js'
import { createEncounterMovementPassageChoice } from './encounterMovementPassageChoice.js'
import { prepareEncounterMovementPassageContest } from './encounterMovementPassageContestPreparation.js'
import { prepareActionEconomyConsumption } from './encounterActionSettlementCore.js'

export interface LiveSceneCommandContext {
  authorityId: string
  campaignId: string
  sessionId: string
}

export interface LiveSceneOptions {
  /** Server-resolved Encounter overlay for mechanics-bearing Scene movement. */
  encounterId?: string
  liveSceneContext?: LiveSceneCommandContext
  sceneVisionContext?: LiveSessionSceneVisionContextDto
  liveSessionAuthority?: LiveSessionCommandAuthority
  /** Server composition only; no client selects a rule runtime. */
  rulesRuntime?: RulesRuntimeService
  /** Focused-test seam for deterministic occurrence identities. */
  createRuleOccurrenceId?: () => string
  /** Focused-test seam for authoritative system d20 rolls. */
  rollD20?: () => number
}

function fingerprint(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

function sceneCommandFingerprint(input: SceneCommandInputDto): string {
  if (input.type !== 'UPSERT_SCENE_DARKNESS') return fingerprint(input)
  const { legacyReplayKind: _legacyReplayKind, ...command } = input
  return fingerprint(command)
}

function legacyVisualOnlyDarknessFingerprint(input: SceneCommandInputDto): string | null {
  if (
    input.type !== 'UPSERT_SCENE_DARKNESS' ||
    input.zone.mechanicalIllumination !== null ||
    input.zone.mechanicalObscurement !== null
  )
    return null
  const { legacyReplayKind: _legacyReplayKind, zone, ...command } = input
  const {
    mechanicalIllumination: _mechanicalIllumination,
    mechanicalObscurement: _mechanicalObscurement,
    ...legacyZone
  } = zone
  return fingerprint({ ...command, zone: legacyZone })
}

function assertSpatialOccurrenceRootIdentity(input: {
  occurrence: RuleOccurrenceRecord
  receipt: RuleOccurrenceReceipt | null
  commandFingerprint: string
  commandId: string
  correlationId: string | null
  encounterId: string
  expectedEncounterVersion: number
  expectedSceneVersion: number
  movementKind: string
  sceneId: string
  tokenId: string
  userId: string
}): void {
  const pendingContext = input.occurrence.pendingSnapshot?.applicationContext
  const metadata =
    input.occurrence.state === 'PENDING' &&
    (pendingContext?.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
      pendingContext?.kind === 'ENCOUNTER_MOVEMENT_REACTION')
      ? {
          rootCommandId: pendingContext.root.commandId,
          rootCommandFingerprint: pendingContext.root.commandFingerprint,
          rootCorrelationId: pendingContext.root.correlationId,
          rootInitiatorUserId: pendingContext.root.initiatorUserId,
          encounterId: pendingContext.root.encounterId,
          rootExpectedEncounterVersion: pendingContext.root.expectedEncounterVersion,
          rootExpectedSceneVersion: pendingContext.root.expectedSceneVersion,
          movementKind: pendingContext.root.movementKind,
          sceneId: pendingContext.root.sceneId,
          tokenId: pendingContext.root.tokenId
        }
      : input.receipt?.commandMetadata.transition === 'SPATIAL_MOVEMENT'
        ? input.receipt.commandMetadata
        : null
  if (
    !metadata ||
    metadata.rootCommandId !== input.commandId ||
    metadata.rootCommandFingerprint !== input.commandFingerprint ||
    metadata.rootInitiatorUserId !== input.userId ||
    metadata.rootCorrelationId !== input.correlationId ||
    metadata.encounterId !== input.encounterId ||
    metadata.sceneId !== input.sceneId ||
    metadata.tokenId !== input.tokenId ||
    metadata.rootExpectedEncounterVersion !== input.expectedEncounterVersion ||
    metadata.rootExpectedSceneVersion !== input.expectedSceneVersion ||
    metadata.movementKind !== input.movementKind
  ) {
    throw new EncounterConflictError(
      'Movement occurrence identity does not match its root command.'
    )
  }
}

async function appendPendingRootSpatialMovementReceipt(input: {
  occurrences: ReturnType<typeof createRuleOccurrenceRepository>
  occurrence: RuleOccurrenceRecord
  encounterId: string
  command: EncounterMovementSceneCommand
  commandFingerprint: string
  actorUserId: string
  pendingEncounterVersion: number
  pendingSnapshot: NonNullable<RuleOccurrenceRecord['pendingSnapshot']>
  pendingSceneVersion: number
  changedAggregates: MovementChangedAggregate[]
  viewer: { membershipRole: 'OWNER' | 'PLAYER'; assignedCharacterId: string | null }
}): Promise<void> {
  const context = input.pendingSnapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' &&
    context.kind !== 'ENCOUNTER_MOVEMENT_REACTION'
  )
    throw new EncounterConflictError('Spatial movement result is unavailable.')
  const occurrence = projectEncounterSpatialOccurrenceSummary(
    input.occurrence,
    input.pendingEncounterVersion,
    input.viewer
  )
  const resultPayload = storedRuleExecutionResultDtoSchema.parse({
    status: 'ENCOUNTER_OCCURRENCE_PENDING',
    schemaVersion: 1,
    occurrenceId: input.occurrence.id,
    occurrenceVersion: input.occurrence.version,
    encounterId: input.encounterId,
    encounterVersion: input.pendingEncounterVersion,
    occurrence,
    characterTransitions: input.changedAggregates
      .filter((aggregate) => aggregate.aggregateKind === 'CHARACTER')
      .map((aggregate) => ({
        characterId: aggregate.aggregateId,
        beforeStreamVersion: aggregate.beforeVersion,
        afterStreamVersion: aggregate.version
      }))
  })
  await input.occurrences.appendReceipt({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.encounterId,
    commandId: input.command.commandId,
    commandFingerprint: input.commandFingerprint,
    occurrenceId: input.occurrence.id,
    aggregateVersion: input.pendingEncounterVersion,
    commandType: input.command.type,
    actorUserId: input.actorUserId,
    correlationId: input.command.correlationId,
    commandMetadata: {
      schemaVersion: 1,
      transition: 'SPATIAL_MOVEMENT',
      commandType: 'MOVE_SCENE_TOKEN',
      rootCommandId: context.root.commandId,
      rootCommandFingerprint: context.root.commandFingerprint,
      rootInitiatorUserId: context.root.initiatorUserId,
      rootCorrelationId: context.root.correlationId,
      encounterId: context.root.encounterId,
      sceneId: context.root.sceneId,
      tokenId: context.root.tokenId,
      movementKind: context.root.movementKind,
      expectedEncounterVersion: input.command.expectedEncounterVersion,
      expectedSceneVersion: input.command.expectedSceneVersion,
      rootExpectedEncounterVersion: context.root.expectedEncounterVersion,
      rootExpectedSceneVersion: context.root.expectedSceneVersion,
      encounterVersionTransition:
        input.pendingEncounterVersion === input.command.expectedEncounterVersion
          ? 'UNCHANGED'
          : 'ADVANCED',
      sceneVersionTransition:
        input.pendingSceneVersion === input.command.expectedSceneVersion ? 'UNCHANGED' : 'ADVANCED',
      currentnessChecksum:
        context.kind === 'ENCOUNTER_MOVEMENT_REACTION' ? context.spatialCurrentnessChecksum : null,
      selectionChecksum:
        context.kind === 'ENCOUNTER_MOVEMENT_REACTION'
          ? context.spatialSelectionChecksum
          : context.selectionChecksum,
      occurrenceVersion: input.occurrence.version,
      changedAggregates: input.changedAggregates,
      resolutionCommands: [...context.root.resolutionCommands]
    },
    resultPayload
  })
}

function samePoint(left: { x: number; y: number }, right: { x: number; y: number }): boolean {
  return Math.abs(left.x - right.x) <= 1e-8 && Math.abs(left.y - right.y) <= 1e-8
}

/** Exact polyline slice by distance; avoids using position lookup on self-intersecting paths. */
function sliceMovementPath(
  path: readonly { x: number; y: number }[],
  startDistance: number,
  endDistance: number
): { x: number; y: number }[] {
  if (startDistance < 0 || endDistance < startDistance) {
    throw new EncounterValidationError('Movement slice distances are invalid.')
  }
  let walked = 0
  const result: { x: number; y: number }[] = []
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!
    const to = path[index]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const segmentStart = walked
    const segmentEnd = walked + length
    const overlapStart = Math.max(startDistance, segmentStart)
    const overlapEnd = Math.min(endDistance, segmentEnd)
    if (overlapStart <= overlapEnd + 1e-8 && length > 0) {
      const pointAt = (distance: number) => {
        const ratio = Math.max(0, Math.min(1, (distance - segmentStart) / length))
        return {
          x: from.x + (to.x - from.x) * ratio,
          y: from.y + (to.y - from.y) * ratio
        }
      }
      const start = pointAt(overlapStart)
      const end = pointAt(overlapEnd)
      if (result.length === 0 || !samePoint(result.at(-1)!, start)) result.push(start)
      if (!samePoint(result.at(-1)!, end)) result.push(end)
    }
    walked = segmentEnd
  }
  if (result.length === 0) throw new EncounterValidationError('Movement slice is outside its path.')
  return result
}

function movementPathLength(path: readonly { x: number; y: number }[]): number {
  return path.slice(1).reduce((total, point, index) => {
    const prior = path[index]!
    return total + Math.hypot(point.x - prior.x, point.y - prior.y)
  }, 0)
}

/** Keeps automatic contact resolution authoritative without writing an intermediate Scene event. */
function stageSceneTokenPosition(
  scene: CampaignSceneState,
  tokenId: string,
  position: { x: number; y: number }
): CampaignSceneState {
  return {
    ...scene,
    tokens: scene.tokens.map((token) => (token.id === tokenId ? { ...token, position } : token))
  }
}

function currentMovementReactionDistance(timeline: MovementReactionTimelineDto): number | null {
  const entry = timeline[0]
  if (!entry) return null
  return entry.kind === 'AUTOMATIC_ACTION'
    ? entry.option.candidate.pathDistance
    : entry.group.pathDistance
}

function nextMovementTimelineBoundaryDistance(
  timeline: MovementReactionTimelineDto,
  pendingPassageDistance: number | null
): number | null {
  const reactionDistance = currentMovementReactionDistance(timeline)
  return reactionDistance === null
    ? pendingPassageDistance
    : pendingPassageDistance === null
      ? reactionDistance
      : Math.min(reactionDistance, pendingPassageDistance)
}

async function filterExecutableMovementPassageOptions<T>(input: {
  options: readonly T[]
  prepare: (option: T) => Promise<void>
}): Promise<T[]> {
  const executable: T[] = []
  for (const option of input.options) {
    try {
      await input.prepare(option)
      executable.push(option)
    } catch {
      // Missing authoritative contest facts make this option unavailable.
    }
  }
  return executable
}

async function availableMovementPassageChoice(input: {
  encounter: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>['encounter']
  movement: Parameters<typeof createEncounterMovementPassageChoice>[0]['movement']
  sourceActorId: string
  sourceControllerCharacterId: string | null
  targets: Awaited<ReturnType<typeof lockEncounterActiveEffectTargets>>
  db: DBLike
}) {
  if (input.encounter.automationMode === 'MANUAL') return null
  const sourceActor = input.encounter.actors.find((actor) => actor.id === input.sourceActorId)
  if (!sourceActor || !input.encounter.optionalCombatSnapshotChecksum) return null
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.safeParse(
    input.encounter.optionalCombatSnapshot
  )
  if (!snapshot.success) return null
  const definitions = activeOptionalCombatDefinitions({
    automationMode: input.encounter.automationMode,
    snapshot: snapshot.data
  })
  const economies = await Promise.all(
    (['ACTION', 'BONUS_ACTION'] as const).map(async (economy) => {
      try {
        const prepared = await prepareActionEconomyConsumption({
          db: input.db,
          encounter: input.encounter,
          activation: { code: economy, amount: 1 },
          gameSystemId: input.encounter.gameSystemId,
          sourceActor,
          targets: input.targets
        })
        return prepared ? economy : null
      } catch {
        return null
      }
    })
  )
  const options = definitions.flatMap((definition) => {
    const ruleKind = definition.document.kind
    if (ruleKind !== 'OVERRUN' && ruleKind !== 'TUMBLE') return []
    return economies.flatMap((economy) =>
      economy
        ? [
            {
              ruleKind,
              economy,
              definitionId: definition.definitionId,
              definitionVersion: definition.definitionVersion,
              definitionChecksum: definition.definitionChecksum,
              moduleKey: definition.document.module.policyModuleKey,
              moduleContractVersion: definition.document.module.contractVersion
            }
          ]
        : []
    )
  })
  if (options.length === 0) return null
  const provisional = createEncounterMovementPassageChoice({
    movement: input.movement,
    sourceActorId: input.sourceActorId,
    sourceControllerCharacterId: input.sourceControllerCharacterId,
    options
  })
  const executableIssuedOptions = await filterExecutableMovementPassageOptions({
    options: provisional.options,
    prepare: async (option) => {
      await prepareEncounterMovementPassageContest({
        choice: provisional,
        db: input.db,
        encounter: input.encounter,
        optionId: option.optionId,
        targets: input.targets
      })
    }
  })
  const executableOptionIds = new Set(executableIssuedOptions.map((option) => option.optionId))
  const executableOptions = options.filter((candidate) =>
    provisional.options.some(
      (option) =>
        executableOptionIds.has(option.optionId) &&
        candidate.definitionId === option.definitionId &&
        candidate.definitionVersion === option.definitionVersion &&
        candidate.economy === option.economy &&
        candidate.ruleKind === option.ruleKind
    )
  )
  return executableOptions.length === 0
    ? null
    : createEncounterMovementPassageChoice({
        movement: input.movement,
        sourceActorId: input.sourceActorId,
        sourceControllerCharacterId: input.sourceControllerCharacterId,
        options: executableOptions
      })
}

/**
 * Commits only the authoritative portion of a spatial path.  Fog may change
 * over a positive segment even where the token returns to its exact prior
 * position, so no-op token deltas are never used as a persistence surrogate.
 */
export async function commitSpatialSceneMovement(input: {
  repository: ReturnType<typeof createVttSceneRepository>
  scene: CampaignLiveSceneRecord
  encounterId: string
  actorUserId: string
  commandId: string
  commandType: string
  commandFingerprint: string
  tokenId: string
  path: readonly { x: number; y: number }[]
  startDistance: number
  endDistance: number
  endPosition: { x: number; y: number }
  sceneVisionContext?: LiveSessionSceneVisionContextDto
  liveSceneContext?: LiveSceneCommandContext
}): Promise<{
  delta: SceneDelta | null
  state: CampaignSceneState
  version: number
}> {
  const committedPath = sliceMovementPath(input.path, input.startDistance, input.endDistance)
  const currentToken = input.scene.state.tokens.find((token) => token.id === input.tokenId)
  if (!currentToken) throw new EncounterConflictError('Movement token is no longer present.')
  const exploratoryMove: SceneAtomicDelta = {
    kind: 'TOKEN_MOVED',
    tokenId: input.tokenId,
    position: input.endPosition
  }
  const afterMove = applySceneEvent(input.scene.state, {
    actorUserId: input.actorUserId,
    commandId: input.commandId,
    delta: exploratoryMove,
    sceneId: input.scene.state.id,
    version: input.scene.state.version + 1
  })
  const explorationDeltas = explorationDeltasFor(
    input.scene.state,
    afterMove,
    exploratoryMove,
    input.sceneVisionContext,
    committedPath
  )
  const deltas: SceneAtomicDelta[] = [
    ...(samePoint(currentToken.position, input.endPosition) ? [] : [exploratoryMove]),
    ...explorationDeltas
  ]
  if (deltas.length === 0) {
    return {
      delta: null,
      state: input.scene.state,
      version: input.scene.state.version
    }
  }
  const delta: SceneDelta = deltas.length === 1 ? deltas[0]! : { kind: 'BATCH', deltas }
  const event = {
    actorUserId: input.actorUserId,
    commandId: input.commandId,
    delta,
    sceneId: input.scene.state.id,
    version: input.scene.state.version + 1
  }
  const state = applySceneEvent(input.scene.state, event)
  const projection = compileSceneCurrentProjection(state)
  const published = input.liveSceneContext
    ? await input.repository.publishLiveCommand({
        commandFingerprint: input.commandFingerprint,
        commandType: input.commandType,
        encounterId: input.encounterId,
        event,
        eventId: randomUUID(),
        expectedVersion: input.scene.state.version,
        projection
      })
    : await (async () => {
        await input.repository.appendEvent({
          commandFingerprint: input.commandFingerprint,
          commandType: input.commandType,
          encounterId: input.encounterId,
          event,
          id: randomUUID()
        })
        return input.repository.updateProjection({
          expectedVersion: input.scene.state.version,
          projection
        })
      })()
  if (!published) throw new EncounterConflictError('Scene changed before movement completed.')
  return { delta, state, version: event.version }
}

function commandToDelta(input: SceneCommandInputDto): SceneAtomicDelta {
  switch (input.type) {
    case 'UPSERT_SCENE_TOKEN':
      return { kind: 'TOKEN_UPSERTED', token: input.token }
    case 'REMOVE_SCENE_TOKEN':
      return { kind: 'TOKEN_REMOVED', tokenId: input.tokenId }
    case 'MOVE_SCENE_TOKEN':
      return {
        kind: 'TOKEN_MOVED',
        position: input.path.at(-1)!,
        tokenId: input.tokenId
      }
    case 'SET_SCENE_DOOR_STATE':
      return {
        kind: 'DOOR_STATE_SET',
        barrierId: input.barrierId,
        state: input.state
      }
    case 'UPSERT_SCENE_BARRIER':
      return { kind: 'BARRIER_UPSERTED', barrier: input.barrier }
    case 'REMOVE_SCENE_BARRIER':
      return { kind: 'BARRIER_REMOVED', barrierId: input.barrierId }
    case 'SET_SCENE_AMBIENT_ILLUMINATION':
      return {
        kind: 'AMBIENT_ILLUMINATION_SET',
        illumination: input.illumination
      }
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
      return {
        kind: 'MEASUREMENT_REMOVED',
        measurementId: input.measurementId
      }
    case 'UNDO_LAST_SCENE_MOVE':
      throw new EncounterValidationError('Undo must be resolved from the persisted scene history.')
  }
}

function atomicDeltas(delta: SceneDelta): readonly SceneAtomicDelta[] {
  return delta.kind === 'BATCH' ? delta.deltas : [delta]
}

function createUndoLastMoveDelta(
  state: CampaignSceneState,
  definition: SceneDefinition,
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
  const prior = replayCampaignSceneProjection({
    definition,
    events: history.slice(0, targetIndex).map(({ event }) => event),
    sceneId: state.id
  })
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

function assertPointWithinMap(state: CampaignSceneState, point: { x: number; y: number }): void {
  if (point.x < 0 || point.y < 0 || point.x > state.map.width || point.y > state.map.height) {
    throw new EncounterValidationError('Token movement must remain within the map bounds.')
  }
}

function assertTokenMovement(
  state: CampaignSceneState,
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
  state: CampaignSceneState,
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
  priorState: CampaignSceneState,
  state: CampaignSceneState,
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

async function requireEncounter(db: DBLike, encounterId: string, userId: string, write: boolean) {
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
    const repository = createVttSceneRepository(trx)
    const createdDefinition = await repository.createDefinition(definition)
    const state = materializeCampaignScene(createdDefinition.definition, randomUUID())
    await repository.createCampaignLiveScene({
      definitionSnapshot: createdDefinition.definition,
      materializationCommandFingerprint: checksumRuleDocument({
        definitionId: createdDefinition.definition.id,
        kind: 'DEFAULT_CAMPAIGN_LIVE_SCENE'
      }),
      materializationCommandId: randomUUID(),
      projection: compileSceneCurrentProjection(state)
    })
    return createdDefinition.definition
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

export async function listCampaignLiveScenes(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignLiveSceneSummaryDto[]> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertCampaignOwner(authority)
  return createVttSceneRepository(db)
    .listLiveScenes(campaignId)
    .then((rows) =>
      rows.map(({ state }) => ({
        definitionId: state.definitionId,
        id: state.id,
        name: state.name,
        version: state.version
      }))
    )
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

export async function getCampaignSessionLiveScenePresentation(
  db: DBLike,
  userId: string,
  input: { campaignId: string; sessionId: string }
): Promise<{ sceneId: string | null; sessionId: string; version: number } | null> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  const repository = createVttSceneRepository(db)
  if ((await repository.findSessionCampaignId(input.sessionId)) !== input.campaignId) return null
  const presentation = await repository.findSessionPresentation(input.sessionId)
  return presentation ? { ...presentation, sessionId: input.sessionId } : null
}

export async function setCampaignLiveScenePresentation(
  db: DBLike,
  userId: string,
  rawInput: SetCampaignLiveScenePresentationInputDto,
  options: LiveSceneOptions = {}
): Promise<SetCampaignLiveScenePresentationResultDto> {
  const input = setCampaignLiveScenePresentationInputDtoSchema.parse(rawInput)
  const commandFingerprint = fingerprint(input)
  return withTransaction(db, async (trx) => {
    const repository = createVttSceneRepository(trx)
    const campaignId = await repository.findSessionCampaignId(input.sessionId)
    if (!campaignId) throw new CampaignAccessError('Campaign Session is unavailable.')
    const campaign = await createCampaignRepository(trx).lockCampaign(campaignId)
    if (!campaign) throw new CampaignAccessError('Campaign Session is unavailable.')
    const authority = await resolveCampaignAuthority(trx, campaign.id, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)

    const session = await repository.lockSession(campaign.id, input.sessionId)
    if (session?.status !== 'OPEN')
      throw new CampaignConflictError('Finished Sessions cannot present Scenes.')
    await assertSessionLiveSessionCommandAuthority(
      trx,
      input.sessionId,
      options.liveSessionAuthority
    )

    const prior = await repository.findSessionScenePresentationReceipt({
      campaignId: campaign.id,
      commandId: input.commandId
    })
    if (prior) {
      if (prior.commandFingerprint !== commandFingerprint) {
        throw new CampaignConflictError('Command ID was already used with different input.')
      }
      return setCampaignLiveScenePresentationResultDtoSchema.parse({
        ...prior.result,
        replayed: true
      })
    }

    if (input.sceneId) {
      const scene = await repository.lockLiveScene(input.sceneId)
      if (!scene || scene.state.campaignId !== campaign.id) {
        throw new EncounterValidationError('Campaign live Scene was not found.')
      }
    }
    const updated = await repository.presentSessionScene({
      campaignId: campaign.id,
      commandFingerprint,
      commandId: input.commandId,
      expectedVersion: input.expectedPresentationVersion,
      sceneId: input.sceneId,
      sessionId: input.sessionId
    })
    if (!updated) throw new CampaignConflictError('Session Scene presentation version is stale.')
    const presentation = await repository.findSessionPresentation(input.sessionId)
    if (!presentation) throw new CampaignConflictError('Session Scene presentation was not saved.')
    const result = setCampaignLiveScenePresentationResultDtoSchema.parse({
      commandId: input.commandId,
      replayed: false,
      sceneId: presentation.sceneId,
      sessionId: input.sessionId,
      version: presentation.version
    })
    await repository.appendSessionScenePresentationReceipt({
      actorUserId: userId,
      campaignId: campaign.id,
      commandId: input.commandId,
      receipt: { commandFingerprint, result }
    })
    return result
  })
}

export async function bindEncounterToPresentedScene(
  db: DBLike,
  userId: string,
  input: BindEncounterToPresentedSceneInputDto,
  options: LiveSceneOptions = {}
): Promise<BindEncounterToPresentedSceneResultDto> {
  return withTransaction(db, async (trx) => {
    const { authority, encounter } = await requireEncounter(trx, input.encounterId, userId, true)
    assertCampaignOwner(authority)
    await assertSessionLiveSessionCommandAuthority(
      trx,
      encounter.sessionId,
      options.liveSessionAuthority
    )
    const repository = createVttSceneRepository(trx)
    const commandFingerprint = fingerprint(input)
    const existing = await repository.findEncounterBinding(encounter.id)
    if (existing) {
      if (
        existing.commandId !== input.commandId ||
        existing.commandFingerprint !== commandFingerprint
      )
        throw new EncounterConflictError(
          'Encounter already has a different Campaign Scene binding.'
        )
      return {
        commandId: input.commandId,
        encounterId: encounter.id,
        replayed: true,
        sceneId: existing.sceneId
      }
    }
    const presentation = await repository.findSessionPresentation(encounter.sessionId)
    if (!presentation?.sceneId)
      throw new EncounterValidationError('The Session is not presenting a Campaign Scene.')
    const scene = await repository.lockLiveScene(presentation.sceneId)
    if (!scene || scene.state.campaignId !== encounter.campaignId)
      throw new EncounterValidationError('The presented Campaign Scene is unavailable.')
    if (
      !(await repository.bindEncounterToScene({
        campaignId: encounter.campaignId,
        commandFingerprint,
        commandId: input.commandId,
        encounterId: encounter.id,
        sceneId: scene.state.id
      }))
    )
      throw new EncounterConflictError(
        'Encounter Scene binding changed before it could be created.'
      )
    return {
      commandId: input.commandId,
      encounterId: encounter.id,
      replayed: false,
      sceneId: scene.state.id
    }
  })
}

type EncounterActorTokenBindingCommand =
  | SetEncounterSceneActorTokenBindingInputDto
  | RemoveEncounterSceneActorTokenBindingInputDto

export async function executeEncounterSceneActorTokenBindingCommand(
  db: DBLike,
  userId: string,
  input: EncounterActorTokenBindingCommand,
  options: LiveSceneOptions = {}
): Promise<{ replayed: boolean; response: EncounterCommandResultDto }> {
  const commandFingerprint = fingerprint(input)
  return withTransaction(db, async (trx) => {
    const locked = await lockEncounterRuleExecutionCommandContext(trx, {
      actorUserId: userId,
      authority: 'ACTIVE_MEMBER',
      encounterId: input.encounterId,
      ...(options.liveSessionAuthority
        ? { liveSessionAuthority: options.liveSessionAuthority }
        : {})
    })
    if (locked.context.role !== 'OWNER') {
      throw new EncounterValidationError(
        'Only the Campaign owner can bind Encounter actors to Scene tokens.'
      )
    }
    const encounters = createEncounterRepository(trx)
    const prior = await encounters.findEventByCommand(input.encounterId, input.commandId)
    if (prior) {
      if (prior.commandFingerprint !== commandFingerprint || prior.commandType !== input.type) {
        throw new EncounterConflictError('Command ID was already used with different input.')
      }
      return {
        replayed: true,
        response: encounterProjectionEventSchema.parse(prior.resultPayload).command
      }
    }
    if (locked.encounter.version !== input.expectedEncounterVersion) {
      throw new EncounterConflictError('Encounter changed before its Scene binding could update.')
    }
    const scenes = createVttSceneRepository(trx)
    const binding = await scenes.findEncounterBinding(locked.encounter.id)
    if (!binding || binding.sceneId !== input.sceneId) {
      throw new EncounterValidationError('Encounter Scene binding was not found.')
    }
    const scene = await scenes.lockLiveScene(input.sceneId)
    if (!scene || scene.state.campaignId !== locked.encounter.campaignId) {
      throw new EncounterValidationError('Campaign live Scene was not found.')
    }
    if (!locked.encounter.actors.some((actor) => actor.id === input.actorId)) {
      throw new EncounterValidationError('Encounter actor was not found.')
    }
    if (input.type === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING') {
      if (!scene.state.tokens.some((token) => token.id === input.tokenId)) {
        throw new EncounterValidationError('Scene token was not found.')
      }
      await scenes.setActorTokenBinding({
        actorId: input.actorId,
        encounterId: input.encounterId,
        sceneId: input.sceneId,
        tokenId: input.tokenId
      })
    } else if (
      !(await scenes.removeActorTokenBinding({
        actorId: input.actorId,
        encounterId: input.encounterId
      }))
    ) {
      throw new EncounterValidationError('Encounter actor token binding was not found.')
    }

    const version = locked.encounter.version + 1
    await encounters.update({
      encounterId: locked.encounter.id,
      status: locked.encounter.status,
      version,
      round: locked.encounter.round,
      currentActorId: locked.encounter.currentActorId
    })
    const updated = await encounters.find(locked.encounter.id)
    if (!updated) throw new EncounterNotFoundError()
    const actorSnapshot = await evaluateEncounterActorRuleSnapshot({ db: trx, encounter: updated })
    const gmProjection = projectGm(actorSnapshot.reconciledEncounter, actorSnapshot.snapshot.output)
    const response = encounterCommandResultDtoSchema.parse({
      occurrence: null,
      projection: gmProjection,
      resolution: null,
      roll: null
    })
    const currentProjection = compileEncounterCurrentProjection(
      gmProjection,
      actorSnapshot.snapshot
    )
    await encounters.publishCurrentProjection(currentProjection)
    await encounters.appendEvent({
      id: randomUUID(),
      encounterId: updated.id,
      campaignId: updated.campaignId,
      version,
      commandId: input.commandId,
      commandType: input.type,
      commandFingerprint,
      commandPayload: input as unknown as Json,
      resultPayload: encounterProjectionEventSchema.parse({
        command: response,
        currentProjection,
        ruleReceipt: null,
        optionalCombatSnapshotChecksum: updated.optionalCombatSnapshotChecksum
      }) as unknown as Json,
      actorUserId: userId,
      correlationId: null
    })
    return { replayed: false, response }
  })
}

export async function getEncounterSceneProjection(
  db: DBLike,
  userId: string,
  input: { encounterId: string }
): Promise<CampaignSceneState> {
  const { authority, encounter } = await requireEncounter(db, input.encounterId, userId, false)
  const binding = await createVttSceneRepository(db).findEncounterBinding(encounter.id)
  const scene = binding ? await createVttSceneRepository(db).findLiveScene(binding.sceneId) : null
  if (!scene) throw new EncounterValidationError('Encounter scene was not found.')
  return projectSceneForViewer(scene.state, {
    role: authority.membership.role === 'OWNER' ? 'GM' : 'PLAYER',
    userId
  })
}

type EncounterMovementSceneCommand = Extract<SceneCommandInputDto, { type: 'MOVE_SCENE_TOKEN' }> & {
  expectedEncounterVersion: number
}

async function executeCampaignSceneCommandWithoutEncounter(
  db: DBLike,
  userId: string,
  input: SceneCommandInputDto,
  options: LiveSceneOptions
): Promise<{ result: SceneCommandResultDto; state: CampaignSceneState }> {
  if (input.type === 'MOVE_SCENE_TOKEN' && input.expectedEncounterVersion !== null) {
    throw new EncounterValidationError('Mechanics-bearing movement requires an Encounter overlay.')
  }
  return withTransaction(db, async (trx) => {
    const repository = createVttSceneRepository(trx)
    const locatedScene = await repository.findLiveScene(input.sceneId)
    if (!locatedScene) throw new EncounterValidationError('Campaign live Scene was not found.')

    const campaign = await createCampaignRepository(trx).lockCampaign(locatedScene.state.campaignId)
    if (!campaign) throw new CampaignAccessError()
    const authority = await resolveCampaignAuthority(trx, campaign.id, userId)
    assertActiveCampaignMember(authority)
    assertCampaignWritable(authority)

    if (options.liveSceneContext) {
      if (options.liveSceneContext.campaignId !== campaign.id) throw new CampaignAccessError()
      const session = await repository.lockSession(campaign.id, options.liveSceneContext.sessionId)
      if (session?.status !== 'OPEN') throw new CampaignAccessError()
      await assertSessionLiveSessionCommandAuthority(
        trx,
        options.liveSceneContext.sessionId,
        options.liveSessionAuthority
      )
      const presentation = await repository.findSessionPresentation(
        options.liveSceneContext.sessionId
      )
      if (presentation?.sceneId !== input.sceneId) throw new CampaignAccessError()
    }

    const scene = await repository.lockLiveScene(input.sceneId)
    if (!scene || scene.state.campaignId !== campaign.id) {
      throw new EncounterValidationError('Campaign live Scene was not found.')
    }
    const commandFingerprint = sceneCommandFingerprint(input)
    const prior = await repository.findEventByCommand(scene.state.id, input.commandId)
    if (prior) {
      const legacyFingerprint = legacyVisualOnlyDarknessFingerprint(input)
      if (
        (prior.commandFingerprint !== commandFingerprint &&
          prior.commandFingerprint !== legacyFingerprint) ||
        prior.commandType !== input.type
      ) {
        throw new EncounterConflictError('Command ID was already used with different input.')
      }
      return {
        result: {
          commandId: prior.event.commandId,
          delta: prior.event.delta,
          occurrence: null,
          replayed: true,
          sceneId: prior.event.sceneId,
          version: prior.event.version
        },
        state: scene.state
      }
    }
    if (
      input.type === 'UPSERT_SCENE_DARKNESS' &&
      input.legacyReplayKind === LEGACY_VISUAL_ONLY_DARKNESS_REPLAY_KIND
    ) {
      throw new EncounterValidationError(
        'Legacy visual-only darkness input is valid only for replaying a committed command.'
      )
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
    const state = applySceneEvent(scene.state, event)
    const published = await repository.publishLiveCommand({
      commandFingerprint,
      commandType: input.type,
      encounterId: null,
      event,
      eventId: randomUUID(),
      expectedVersion: scene.state.version,
      projection: compileSceneCurrentProjection(state)
    })
    if (!published) throw new EncounterConflictError('Scene changed before this command completed.')
    return {
      result: {
        commandId: event.commandId,
        delta: event.delta,
        occurrence: null,
        replayed: false,
        sceneId: event.sceneId,
        version: event.version
      },
      state
    }
  })
}

export async function executeEncounterSceneCommandWithState(
  db: DBLike,
  userId: string,
  input: SceneCommandInputDto,
  options: LiveSceneOptions = {}
): Promise<{
  result: SceneCommandResultDto
  state: CampaignSceneState
  spatialChangedAggregates?: MovementChangedAggregate[]
  spatialTerminalResult?: Extract<
    StoredRuleExecutionResultDto,
    | { status: 'MOVEMENT_COMPLETE' }
    | { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
  >
}> {
  if (input.type !== 'MOVE_SCENE_TOKEN' || input.expectedEncounterVersion === null) {
    return executeCampaignSceneCommandWithoutEncounter(db, userId, input, options)
  }
  const encounterId = options.encounterId
  if (!encounterId) {
    throw new EncounterValidationError(
      'Mechanics-bearing Scene movement requires a server-resolved Encounter overlay.'
    )
  }
  const movementInput: EncounterMovementSceneCommand = {
    ...input,
    expectedEncounterVersion: input.expectedEncounterVersion
  }
  return withTransaction(db, async (trx) => {
    const input = movementInput
    const repository = createVttSceneRepository(trx)
    const commandFingerprint = sceneCommandFingerprint(input)
    const liveContext = options.liveSceneContext
    const lockedEncounterContext = await lockEncounterRuleExecutionCommandContext(trx, {
      actorUserId: userId,
      authority: 'ACTIVE_MEMBER',
      encounterId,
      ...(options.liveSessionAuthority
        ? { liveSessionAuthority: options.liveSessionAuthority }
        : {})
    })
    const lockedLiveContext = liveContext
      ? await repository.lockLiveCommandContext({
          actorUserId: userId,
          authorityId: liveContext.authorityId,
          campaignId: liveContext.campaignId,
          commandId: input.commandId,
          encounterId,
          sceneId: input.sceneId,
          sessionId: liveContext.sessionId
        })
      : null
    if (liveContext && !lockedLiveContext) throw new CampaignAccessError()

    const binding = lockedLiveContext
      ? null
      : await repository.findEncounterBinding(lockedEncounterContext.encounter.id)
    const scene =
      lockedLiveContext?.scene ??
      (binding?.sceneId === input.sceneId ? await repository.lockLiveScene(input.sceneId) : null)
    if (!scene || scene.state.id !== input.sceneId) {
      throw new EncounterValidationError('Encounter scene was not found.')
    }
    const membershipRole = lockedLiveContext?.membershipRole ?? lockedEncounterContext.context.role
    const prior =
      lockedLiveContext?.priorEvent ??
      (await repository.findEventByCommand(input.sceneId, input.commandId))
    if (prior) {
      const legacyFingerprint = legacyVisualOnlyDarknessFingerprint(input)
      if (
        (prior.commandFingerprint !== commandFingerprint &&
          prior.commandFingerprint !== legacyFingerprint) ||
        prior.commandType !== input.type
      ) {
        throw new EncounterConflictError('Command ID was already used with different input.')
      }
      const occurrences = createRuleOccurrenceRepository(trx)
      const occurrence =
        input.type === 'MOVE_SCENE_TOKEN'
          ? await occurrences.findEncounterByRootCommand(encounterId, input.commandId)
          : null
      const receipt =
        occurrence?.state === 'PENDING' && input.type === 'MOVE_SCENE_TOKEN'
          ? await occurrences.findReceipt('ENCOUNTER', encounterId, input.commandId)
          : occurrence?.state === 'COMPLETED'
            ? await occurrences.findTerminalReceiptByOccurrence(
                'ENCOUNTER',
                encounterId,
                occurrence.id
              )
            : null
      if (occurrence && input.type === 'MOVE_SCENE_TOKEN') {
        assertSpatialOccurrenceRootIdentity({
          occurrence,
          receipt,
          commandFingerprint,
          commandId: input.commandId,
          correlationId: input.correlationId,
          encounterId,
          expectedEncounterVersion: input.expectedEncounterVersion,
          expectedSceneVersion: input.expectedSceneVersion,
          movementKind: input.movementKind,
          sceneId: input.sceneId,
          tokenId: input.tokenId,
          userId
        })
      }
      const spatialChangedAggregates =
        input.type !== 'MOVE_SCENE_TOKEN'
          ? undefined
          : receipt?.commandId === input.commandId &&
              receipt.commandMetadata.transition === 'SPATIAL_MOVEMENT'
            ? receipt.commandMetadata.changedAggregates
            : prior.event.version === input.expectedSceneVersion
              ? []
              : [
                  {
                    aggregateId: prior.event.sceneId,
                    aggregateKind: 'SCENE' as const,
                    beforeVersion: input.expectedSceneVersion,
                    version: prior.event.version
                  }
                ]
      return {
        result: {
          commandId: prior.event.commandId,
          delta: prior.event.delta,
          occurrence: occurrence
            ? projectEncounterSpatialOccurrenceSummary(
                occurrence,
                lockedEncounterContext.encounter.version,
                {
                  membershipRole,
                  assignedCharacterId: lockedEncounterContext.context.assignedCharacterId
                }
              )
            : null,
          replayed: true,
          sceneId: prior.event.sceneId,
          version: prior.event.version
        },
        state: scene.state,
        ...(spatialChangedAggregates ? { spatialChangedAggregates } : {}),
        ...(receipt?.resultPayload.status === 'MOVEMENT_COMPLETE' ||
        (receipt?.resultPayload.status === 'BATCH_COMPLETE' &&
          receipt.resultPayload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
          ? { spatialTerminalResult: receipt.resultPayload }
          : {})
      }
    }
    if (input.type === 'MOVE_SCENE_TOKEN') {
      const occurrences = createRuleOccurrenceRepository(trx)
      const rootOccurrence = await occurrences.findEncounterByRootCommand(
        encounterId,
        input.commandId
      )
      if (rootOccurrence) {
        const receipt =
          rootOccurrence.state === 'PENDING'
            ? await occurrences.findReceipt('ENCOUNTER', encounterId, input.commandId)
            : await occurrences.findTerminalReceiptByOccurrence(
                'ENCOUNTER',
                encounterId,
                rootOccurrence.id
              )
        assertSpatialOccurrenceRootIdentity({
          occurrence: rootOccurrence,
          receipt,
          commandFingerprint,
          commandId: input.commandId,
          correlationId: input.correlationId,
          encounterId,
          expectedEncounterVersion: input.expectedEncounterVersion,
          expectedSceneVersion: input.expectedSceneVersion,
          movementKind: input.movementKind,
          sceneId: input.sceneId,
          tokenId: input.tokenId,
          userId
        })
        const replayVersion =
          rootOccurrence.state === 'PENDING'
            ? rootOccurrence.pendingSnapshot?.applicationContext.kind ===
                'ENCOUNTER_SPATIAL_MOVEMENT' ||
              rootOccurrence.pendingSnapshot?.applicationContext.kind ===
                'ENCOUNTER_MOVEMENT_REACTION'
              ? rootOccurrence.pendingSnapshot.applicationContext.root.currentSceneVersion
              : null
            : receipt?.resultPayload.status === 'MOVEMENT_COMPLETE' ||
                (receipt?.resultPayload.status === 'BATCH_COMPLETE' &&
                  receipt.resultPayload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
              ? receipt.resultPayload.sceneVersion
              : null
        if (replayVersion === null) {
          throw new EncounterConflictError(
            'Movement occurrence has no pinned Scene replay version.'
          )
        }
        return {
          result: {
            commandId: input.commandId,
            delta: null,
            occurrence: projectEncounterSpatialOccurrenceSummary(
              rootOccurrence,
              lockedEncounterContext.encounter.version,
              {
                membershipRole,
                assignedCharacterId: lockedEncounterContext.context.assignedCharacterId
              }
            ),
            replayed: true,
            sceneId: scene.state.id,
            version: replayVersion
          },
          state: scene.state,
          spatialChangedAggregates:
            receipt?.commandId === input.commandId &&
            receipt.commandMetadata.transition === 'SPATIAL_MOVEMENT'
              ? receipt.commandMetadata.changedAggregates
              : [],
          ...(receipt?.resultPayload.status === 'MOVEMENT_COMPLETE' ||
          (receipt?.resultPayload.status === 'BATCH_COMPLETE' &&
            receipt.resultPayload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
            ? { spatialTerminalResult: receipt.resultPayload }
            : {})
        }
      }
    }
    if (await createRuleOccurrenceRepository(trx).lockPendingEncounter(encounterId)) {
      throw new EncounterConflictError('An Encounter rule occurrence is awaiting resolution.')
    }
    let delta: SceneDelta
    {
      const primaryDelta = commandToDelta(input)
      if (membershipRole !== 'OWNER') {
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
      if (input.type === 'MOVE_SCENE_TOKEN') {
        if (lockedEncounterContext.encounter.version !== input.expectedEncounterVersion) {
          throw new EncounterConflictError('Encounter changed before movement could resolve.')
        }
        const occurrenceId = options.createRuleOccurrenceId?.() ?? randomUUID()
        let actorSnapshot: Awaited<ReturnType<typeof evaluateEncounterActorRuleSnapshot>> | null =
          null
        const getEncounterActorSnapshot = async () => {
          actorSnapshot ??= await evaluateEncounterActorRuleSnapshot({
            db: trx,
            encounter: lockedEncounterContext.encounter
          })
          return {
            rules: actorSnapshot.snapshot.output,
            encounter: actorSnapshot.reconciledEncounter
          }
        }
        // Canonical order: Encounter/Scene, then every Character root, then
        // active/spatial effect rows. The same locked bundle is reused below.
        let lockedActors = await lockEncounterActiveEffectTargets({
          trx,
          encounter: lockedEncounterContext.encounter,
          actors: lockedEncounterContext.encounter.actors,
          attunementSlotOverride: lockedEncounterContext.context.attunementSlotOverride,
          getEncounterActorSnapshot
        })
        const spatialScope = await createSpatialRuleEffectRepository(trx).lockScope({
          encounterId,
          sceneId: scene.state.id
        })
        if (!spatialScope)
          throw new EncounterValidationError('Encounter spatial scope was not found.')
        const actorIdByTokenId = new Map(
          (await repository.listActorTokenBindings(encounterId)).map((binding) => [
            binding.tokenId,
            binding.actorId
          ])
        )
        if (!actorIdByTokenId.has(input.tokenId)) {
          throw new EncounterValidationError(
            'Mechanics-bearing movement requires an Encounter actor token binding.'
          )
        }
        const automationMode = lockedEncounterContext.encounter.automationMode
        const reactionTimeline =
          automationMode === 'MANUAL'
            ? []
            : await (async () => {
                const effectiveSceneGrid = encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
                  encounter: lockedEncounterContext.encounter,
                  sceneGrid: scene.state.grid
                })
                const vocabulary = await createSystemVocabularySnapshotRepository(trx).findActive(
                  lockedEncounterContext.encounter.gameSystemId
                )
                if (!vocabulary) {
                  throw new EncounterValidationError('Encounter System vocabulary is unavailable.')
                }
                const encounterFeatureCapabilities =
                  lockedEncounterContext.encounter.actors.flatMap((actor) =>
                    discoverEncounterFeatureActionCapabilities({
                      actor,
                      conditionDefinitionIds: vocabulary.document.conditionTypes.map(
                        (condition) => condition.id
                      ),
                      abilityDefinitions:
                        'schemaVersion' in vocabulary.document &&
                        vocabulary.document.schemaVersion === 2
                          ? vocabulary.document.abilities.map((ability) => ({
                              id: ability.id,
                              code: ability.code
                            }))
                          : []
                    })
                  )
                const resolvePerception = await lockEncounterMovementReactionPerceptionResolver({
                  trx,
                  encounter: lockedEncounterContext.encounter,
                  movingTokenId: input.tokenId,
                  scene: scene.state,
                  sceneGrid: effectiveSceneGrid,
                  actorIdByTokenId,
                  lockedCharacters: lockedActors.lockedCharacters,
                  spatialScope
                })
                const discovery = await discoverEncounterMovementReactionChoices({
                  encounter: lockedEncounterContext.encounter,
                  automationMode,
                  grid: effectiveSceneGrid,
                  movementKind: input.movementKind,
                  movingTokenId: input.tokenId,
                  occurrenceId,
                  path: input.path,
                  tokens: scene.state.tokens,
                  actorIdByTokenId,
                  lockedCharacters: lockedActors.lockedCharacters,
                  activeEffectsByActorId: lockedActors.activeEffectsByActorId,
                  encounterFeatureCapabilities,
                  definitions: createReusableDefinitionRepository(trx),
                  runtime: options.rulesRuntime,
                  lockRelationship: async ({ reactorActorId, movingActorId }) =>
                    createEncounterRepository(trx).lockActorRelationship({
                      encounterId,
                      firstActorId: reactorActorId,
                      secondActorId: movingActorId
                    }),
                  resolvePerception
                })
                return discovery.reactionTimeline
              })()
        const movementRoot = {
          commandId: input.commandId,
          commandFingerprint,
          initiatorUserId: userId,
          correlationId: input.correlationId,
          encounterId,
          sceneId: scene.state.id,
          tokenId: input.tokenId,
          expectedEncounterVersion: input.expectedEncounterVersion,
          expectedSceneVersion: input.expectedSceneVersion,
          movementKind: input.movementKind,
          originalPath: input.path
        } satisfies SpatialMovementRuleRoot
        const movingActorId = actorIdByTokenId.get(input.tokenId)!
        const passageDiscovery =
          automationMode !== 'MANUAL'
            ? await (async () => {
                const relationships = new Map<string, 'ALLIED' | 'NEUTRAL' | 'HOSTILE'>()
                for (const actorId of actorIdByTokenId.values()) {
                  if (actorId === movingActorId) continue
                  const relationship = await createEncounterRepository(trx).lockActorRelationship({
                    encounterId,
                    firstActorId: movingActorId,
                    secondActorId: actorId
                  })
                  if (relationship) relationships.set(actorId, relationship)
                }
                return discoverEncounterMovementPassageContact({
                  actorIdByTokenId,
                  isHostile: ({ blockerActorId }) =>
                    relationships.get(blockerActorId) === 'HOSTILE',
                  movementKind: input.movementKind,
                  movingTokenId: input.tokenId,
                  path: input.path,
                  tokens: scene.state.tokens
                })
              })()
            : { kind: 'NONE' as const }
        if (passageDiscovery.kind === 'ENDPOINT_OCCUPIED') {
          throw new EncounterValidationError(
            'Voluntary movement cannot end inside a hostile occupied footprint.'
          )
        }
        let pendingPassageContact =
          passageDiscovery.kind === 'CROSSING' ? passageDiscovery.contact : null
        const nextPassageStop =
          passageDiscovery.kind === 'CROSSING' && passageDiscovery.laterContacts[0]
            ? (() => {
                const contact = passageDiscovery.laterContacts[0]!
                const token = scene.state.tokens.find(
                  (candidate) => candidate.id === contact.blockerTokenId
                )
                return {
                  ...contact,
                  blockerCurrentnessChecksum: checksumRuleDocument({
                    actorId: contact.blockerActorId,
                    tokenId: contact.blockerTokenId,
                    footprint: token
                  })
                }
              })()
            : null
        const nextMovementBoundaryDistance = (timeline: MovementReactionTimelineDto) =>
          nextMovementTimelineBoundaryDistance(
            timeline,
            pendingPassageContact?.pathDistance ?? null
          )
        let currentEncounter = lockedEncounterContext.encounter
        const refreshMovementTargets = async () => {
          const refreshedEncounter = await createEncounterRepository(trx).find(encounterId)
          if (!refreshedEncounter) throw new EncounterNotFoundError()
          currentEncounter = refreshedEncounter
          lockedActors = await refreshLockedEncounterActiveEffectTargets({
            trx,
            encounter: currentEncounter,
            targets: lockedActors,
            attunementSlotOverride: lockedEncounterContext.context.attunementSlotOverride,
            getEncounterActorSnapshot: async () => {
              const snapshot = await evaluateEncounterActorRuleSnapshot({
                db: trx,
                encounter: currentEncounter
              })
              return { rules: snapshot.snapshot.output, encounter: snapshot.reconciledEncounter }
            }
          })
        }
        let spatial = await evaluateEncounterSpatialMovementRuleBatch({
          trx,
          actorUserId: userId,
          encounter: currentEncounter,
          sceneId: scene.state.id,
          sceneVersion: scene.state.version,
          actorIdByTokenId,
          sceneTokens: scene.state.tokens,
          spatialScope,
          root: movementRoot,
          currentPosition: scene.state.tokens.find((token) => token.id === input.tokenId)!.position,
          occurrenceId,
          executionCommandId: input.commandId,
          runtime: options.rulesRuntime,
          attunementSlotOverride: lockedEncounterContext.context.attunementSlotOverride,
          getEncounterActorSnapshot,
          lockedTargets: lockedActors,
          ...(nextMovementBoundaryDistance(reactionTimeline) === null
            ? {}
            : { interruptAfterPathDistance: nextMovementBoundaryDistance(reactionTimeline)! }),
          ...(options.rollD20 ? { rollD20: options.rollD20 } : {})
        })
        let pendingReactionTimeline = reactionTimeline
        let stagedSceneState = scene.state
        const commandTransitions: MovementCommandTransition[] = []
        const passageChoiceAtCurrentBoundary = async () =>
          pendingPassageContact &&
          spatial.kind === 'REACTION_BOUNDARY' &&
          Math.abs(spatial.boundaryDistance - pendingPassageContact.pathDistance) <= 1e-8 &&
          !spatial.completedExecutions.some(
            (execution) => execution.execution.movementInterruption?.kind === 'STOP'
          )
            ? availableMovementPassageChoice({
                db: trx,
                encounter: currentEncounter,
                movement: {
                  root: {
                    ...movementRoot,
                    currentSceneVersion: scene.state.version + 1,
                    pathChecksum: checksumRuleDocument(movementRoot.originalPath),
                    pathStartDistance: spatial.boundaryDistance,
                    currentPosition: spatial.boundaryPosition,
                    resolutionCommands: [...spatial.resolutionCommands]
                  },
                  blockerActorId: pendingPassageContact.blockerActorId,
                  blockerTokenId: pendingPassageContact.blockerTokenId,
                  contact: pendingPassageContact.contact,
                  contactPathDistance: pendingPassageContact.pathDistance,
                  blockerCurrentnessChecksum: checksumRuleDocument({
                    actorId: pendingPassageContact.blockerActorId,
                    tokenId: pendingPassageContact.blockerTokenId,
                    footprint: scene.state.tokens.find(
                      (token) => token.id === pendingPassageContact!.blockerTokenId
                    )
                  }),
                  nextPassageStop,
                  spatialSelectionChecksum: spatial.selectionChecksum,
                  spatialCurrentnessChecksum: spatial.currentnessChecksum,
                  completedSpatialExecutions: [...spatial.completedExecutions],
                  appliedSpatialPrefix: spatial.appliedPrefix,
                  completedReactionExecutions: [...spatial.completedReactionExecutions],
                  remainingSpatialCandidates: [...spatial.remainingCandidates],
                  reactionTimeline: pendingReactionTimeline
                },
                sourceActorId: movingActorId,
                sourceControllerCharacterId:
                  currentEncounter.actors.find((actor) => actor.id === movingActorId)?.kind ===
                  'CHARACTER'
                    ? (currentEncounter.actors.find((actor) => actor.id === movingActorId)
                        ?.sourceId ?? null)
                    : null,
                targets: lockedActors
              })
            : null
        type SpatialReactionBoundary = Extract<
          Awaited<ReturnType<typeof evaluateEncounterSpatialMovementRuleBatch>>,
          { kind: 'REACTION_BOUNDARY' }
        >
        const resumeAfterBoundary = async (
          boundary: SpatialReactionBoundary,
          completedReaction?: SpatialReactionBoundary['completedReactionExecutions'][number]
        ) => {
          const remainder = {
            root: {
              ...movementRoot,
              currentSceneVersion: scene.state.version,
              pathChecksum: checksumRuleDocument(movementRoot.originalPath),
              pathStartDistance: boundary.boundaryDistance,
              currentPosition: boundary.boundaryPosition,
              resolutionCommands: [...boundary.resolutionCommands]
            },
            spatialSelectionChecksum: boundary.selectionChecksum,
            spatialCurrentnessChecksum: boundary.currentnessChecksum,
            completedSpatialExecutions: [...boundary.completedExecutions],
            appliedSpatialPrefix: boundary.appliedPrefix,
            completedReactionExecutions: [
              ...boundary.completedReactionExecutions,
              ...(completedReaction ? [completedReaction] : [])
            ],
            currentSpatialCandidate: null,
            remainingSpatialCandidates: [...boundary.remainingCandidates],
            reactionTimeline: pendingReactionTimeline
          }
          const nextBoundaryDistance = nextMovementBoundaryDistance(pendingReactionTimeline)
          return evaluateEncounterSpatialMovementRuleBatch({
            trx,
            actorUserId: userId,
            encounter: currentEncounter,
            sceneId: scene.state.id,
            sceneVersion: scene.state.version,
            actorIdByTokenId,
            sceneTokens: stagedSceneState.tokens,
            spatialScope,
            root: movementRoot,
            currentPosition: boundary.boundaryPosition,
            occurrenceId,
            executionCommandId: input.commandId,
            runtime: options.rulesRuntime,
            attunementSlotOverride: lockedEncounterContext.context.attunementSlotOverride,
            getEncounterActorSnapshot: async () => {
              const snapshot = await evaluateEncounterActorRuleSnapshot({
                db: trx,
                encounter: currentEncounter
              })
              return { rules: snapshot.snapshot.output, encounter: snapshot.reconciledEncounter }
            },
            lockedTargets: lockedActors,
            frozenReactionRemainder: remainder,
            ...(nextBoundaryDistance === null
              ? {}
              : { interruptAfterPathDistance: nextBoundaryDistance }),
            ...(options.rollD20 ? { rollD20: options.rollD20 } : {})
          })
        }
        let passageChoice = null as Awaited<ReturnType<typeof availableMovementPassageChoice>>
        while (spatial.kind === 'REACTION_BOUNDARY') {
          const currentBoundary = spatial
          const passageAtBoundary =
            pendingPassageContact !== null &&
            Math.abs(currentBoundary.boundaryDistance - pendingPassageContact.pathDistance) <= 1e-8
          passageChoice = await passageChoiceAtCurrentBoundary()
          if (passageChoice) break
          if (passageAtBoundary) pendingPassageContact = null

          const reactionDistance = currentMovementReactionDistance(pendingReactionTimeline)
          const reactionAtBoundary =
            reactionDistance !== null &&
            Math.abs(currentBoundary.boundaryDistance - reactionDistance) <= 1e-8
          const nextReaction = pendingReactionTimeline[0]
          if (!reactionAtBoundary || !nextReaction) {
            spatial = await resumeAfterBoundary(currentBoundary)
            continue
          }
          if (nextReaction.kind !== 'AUTOMATIC_ACTION') break
          if (!options.rulesRuntime) {
            throw new EncounterValidationError(
              'Automatic movement reactions require the rules runtime.'
            )
          }
          stagedSceneState = stageSceneTokenPosition(
            stagedSceneState,
            input.tokenId,
            currentBoundary.boundaryPosition
          )
          const automatic = await executeAutomaticEncounterMovementReaction({
            db: trx,
            actorUserId: userId,
            encounter: currentEncounter,
            scene: stagedSceneState,
            actorIdByTokenId,
            movingTokenId: input.tokenId,
            movementKind: input.movementKind,
            occurrenceId,
            commandId: input.commandId,
            ordinal: currentBoundary.completedReactionExecutions.length,
            option: nextReaction.option,
            runtime: options.rulesRuntime,
            attunementSlotOverride: lockedEncounterContext.context.attunementSlotOverride,
            spatialScope,
            lockedTargets: lockedActors,
            ...(options.rollD20 ? { rollD20: options.rollD20 } : {})
          })
          if (automatic.kind === 'PENDING') {
            spatial = {
              kind: 'PENDING',
              movementIntent: {
                tokenId: input.tokenId,
                position: currentBoundary.boundaryPosition
              },
              pendingSnapshot: startEncounterAutomaticMovementReactionEvidenceAtBoundary({
                continuation: automatic.continuation.continuation,
                root: movementRoot,
                currentSceneVersion: scene.state.version,
                boundary: currentBoundary,
                reactionTimeline: pendingReactionTimeline,
                selectedOptionId: nextReaction.option.optionId,
                d20Policy: automatic.continuation.d20Policy
              })
            }
            break
          }
          commandTransitions.push({
            kind: 'REACTION',
            execution: automatic.settled.reactionExecution
          })
          await refreshMovementTargets()
          if (automatic.settled.reactionExecution.execution.movementInterruption?.kind === 'STOP') {
            const terminalPosition = stagedSceneState.tokens.find(
              (token) => token.id === input.tokenId
            )!.position
            const stoppedCandidate = currentBoundary.appliedPrefix
              ? storedRuleExecutionResultDtoSchema.parse({
                  ...currentBoundary.appliedPrefix,
                  reactionExecutions: [
                    ...currentBoundary.completedReactionExecutions,
                    automatic.settled.reactionExecution
                  ],
                  terminalPosition
                })
              : storedRuleExecutionResultDtoSchema.parse({
                  status: 'MOVEMENT_COMPLETE',
                  schemaVersion: 1,
                  occurrenceId,
                  occurrenceVersion: 0,
                  encounterId,
                  encounterVersion: lockedEncounterContext.encounter.version + 1,
                  sceneId: scene.state.id,
                  sceneVersion: scene.state.version + 1,
                  tokenId: input.tokenId,
                  movementKind: input.movementKind,
                  reactionExecutions: [
                    ...currentBoundary.completedReactionExecutions,
                    automatic.settled.reactionExecution
                  ],
                  terminalPosition
                })
            if (
              stoppedCandidate.status !== 'MOVEMENT_COMPLETE' &&
              !(
                stoppedCandidate.status === 'BATCH_COMPLETE' &&
                stoppedCandidate.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
              )
            ) {
              throw new EncounterConflictError('The stopped movement result is unavailable.')
            }
            spatial = {
              kind: 'TERMINAL',
              result: stoppedCandidate,
              movementIntent: { tokenId: input.tokenId, position: terminalPosition },
              resolutionCommands: currentBoundary.resolutionCommands,
              selectionChecksum: currentBoundary.selectionChecksum,
              currentnessChecksum: currentBoundary.currentnessChecksum
            }
            break
          }
          pendingReactionTimeline = pendingReactionTimeline.slice(1)
          spatial = await resumeAfterBoundary(currentBoundary, automatic.settled.reactionExecution)
        }
        if (
          spatial.kind === 'PENDING' ||
          spatial.kind === 'REACTION_BOUNDARY' ||
          spatial.kind === 'TERMINAL'
        ) {
          const movement = spatial.movementIntent
          const pendingMovementContext =
            spatial.kind === 'PENDING' ? spatial.pendingSnapshot.applicationContext : null
          if (
            pendingMovementContext !== null &&
            pendingMovementContext.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' &&
            pendingMovementContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION'
          ) {
            throw new EncounterConflictError('Spatial movement result is unavailable.')
          }
          const contactDistance =
            spatial.kind === 'PENDING'
              ? pendingMovementContext!.root.pathStartDistance
              : spatial.kind === 'REACTION_BOUNDARY'
                ? spatial.boundaryDistance
                : spatial.kind === 'TERMINAL' &&
                    spatial.result.reactionExecutions.at(-1)?.execution.movementInterruption
                      ?.kind === 'STOP'
                  ? spatial.result.reactionExecutions.at(-1)!.option.candidate.pathDistance
                  : null
          const committed = await commitSpatialSceneMovement({
            repository,
            scene,
            encounterId,
            actorUserId: userId,
            commandId: input.commandId,
            commandType: input.type,
            commandFingerprint,
            tokenId: input.tokenId,
            path: input.path,
            startDistance: 0,
            endDistance: contactDistance ?? movementPathLength(input.path),
            endPosition:
              movement?.position ??
              scene.state.tokens.find((token) => token.id === input.tokenId)!.position,
            ...(options.sceneVisionContext
              ? { sceneVisionContext: options.sceneVisionContext }
              : {}),
            ...(liveContext ? { liveSceneContext: liveContext } : {})
          })
          const committedState = committed.state
          const committedDelta = committed.delta
          const occurrences = createRuleOccurrenceRepository(trx)
          if (spatial.kind === 'PENDING' || spatial.kind === 'REACTION_BOUNDARY') {
            const pendingSnapshot =
              spatial.kind === 'REACTION_BOUNDARY'
                ? await (async () => {
                    if (passageChoice) {
                      return {
                        snapshotKind: 'AGGREGATE_CHOICE' as const,
                        schemaVersion: 1 as const,
                        occurrenceId,
                        optionalCombatSnapshotChecksum:
                          lockedEncounterContext.encounter.optionalCombatSnapshotChecksum,
                        applicationContext: {
                          ...passageChoice,
                          movement: {
                            ...passageChoice.movement,
                            root: {
                              ...passageChoice.movement.root,
                              currentSceneVersion: committed.version
                            }
                          }
                        }
                      }
                    }
                    const firstEntry = pendingReactionTimeline[0]
                    if (
                      !firstEntry ||
                      firstEntry.kind !== 'CONTROLLER_CHOICE' ||
                      !options.rulesRuntime
                    ) {
                      throw new EncounterConflictError(
                        'The movement reaction choice is unavailable.'
                      )
                    }
                    const choiceDefinitionId =
                      firstEntry.group.options[0]!.policy.choiceDefinitionId
                    if (!choiceDefinitionId)
                      throw new EncounterConflictError(
                        'The movement reaction choice is unavailable.'
                      )
                    return startEncounterMovementReactionAtBoundary({
                      runtime: options.rulesRuntime,
                      occurrenceId,
                      gameSystemId: lockedEncounterContext.encounter.gameSystemId,
                      publishedChoice: createMovementReactionChoiceDefinition({
                        definitionId: choiceDefinitionId,
                        gameSystemId: lockedEncounterContext.encounter.gameSystemId
                      }),
                      root: movementRoot,
                      currentSceneVersion: committed.version,
                      boundary: spatial,
                      reactionTimeline: pendingReactionTimeline
                    })
                  })()
                : (() => {
                    const pendingContext = spatial.pendingSnapshot.applicationContext
                    if (
                      pendingContext.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' &&
                      pendingContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION'
                    ) {
                      throw new EncounterConflictError('Spatial movement result is unavailable.')
                    }
                    return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
                      ...spatial.pendingSnapshot,
                      applicationContext: {
                        ...pendingContext,
                        root: {
                          ...pendingContext.root,
                          currentSceneVersion: committed.version
                        }
                      }
                    })
                  })()
            const mechanicsAppliedBeforePause = commandTransitions.length > 0
            const pendingCharacterAggregates =
              movementCommandCharacterAggregateVersions(commandTransitions)
            const pendingEncounterVersion = mechanicsAppliedBeforePause
              ? await lockedEncounterContext.context.advanceVersion(
                  lockedEncounterContext.encounter.version
                )
              : lockedEncounterContext.encounter.version
            if (mechanicsAppliedBeforePause) {
              const currentEncounter = await createEncounterRepository(trx).find(encounterId)
              if (!currentEncounter) throw new EncounterNotFoundError()
              const currentSnapshot = await evaluateEncounterActorRuleSnapshot({
                db: trx,
                encounter: currentEncounter
              })
              const encounterRepository = createEncounterRepository(trx)
              for (const actor of currentSnapshot.actorUpdates)
                await encounterRepository.updateActor(actor)
              await encounterRepository.publishCurrentProjection(
                compileEncounterCurrentProjection(
                  projectGm(currentSnapshot.reconciledEncounter, currentSnapshot.snapshot.output),
                  currentSnapshot.snapshot
                )
              )
            }
            const occurrence = await occurrences.createPending({
              aggregateKind: 'ENCOUNTER',
              occurrenceId,
              aggregateId: encounterId,
              campaignId: lockedEncounterContext.encounter.campaignId,
              rootCommandId: input.commandId,
              expectedAggregateVersion: pendingEncounterVersion,
              pendingSnapshot
            })
            const spatialChangedAggregates: MovementChangedAggregate[] = [
              ...(mechanicsAppliedBeforePause
                ? [
                    {
                      aggregateId: encounterId,
                      aggregateKind: 'ENCOUNTER' as const,
                      beforeVersion: lockedEncounterContext.encounter.version,
                      version: pendingEncounterVersion
                    }
                  ]
                : []),
              ...pendingCharacterAggregates,
              ...(committedDelta === null
                ? []
                : [
                    {
                      aggregateId: committedState.id,
                      aggregateKind: 'SCENE' as const,
                      beforeVersion: input.expectedSceneVersion,
                      version: committedState.version
                    }
                  ])
            ].sort((left, right) =>
              `${left.aggregateKind}:${left.aggregateId}`.localeCompare(
                `${right.aggregateKind}:${right.aggregateId}`
              )
            )
            await appendPendingRootSpatialMovementReceipt({
              occurrences,
              occurrence,
              encounterId,
              command: input,
              commandFingerprint,
              actorUserId: userId,
              pendingEncounterVersion,
              pendingSnapshot: occurrence.pendingSnapshot!,
              pendingSceneVersion: committedState.version,
              changedAggregates: spatialChangedAggregates,
              viewer: {
                membershipRole,
                assignedCharacterId: lockedEncounterContext.context.assignedCharacterId
              }
            })
            return {
              result: {
                commandId: input.commandId,
                delta: committedDelta,
                occurrence: projectEncounterSpatialOccurrenceSummary(
                  occurrence,
                  pendingEncounterVersion,
                  {
                    membershipRole,
                    assignedCharacterId: lockedEncounterContext.context.assignedCharacterId
                  }
                ),
                replayed: false,
                sceneId: scene.state.id,
                version: committedState.version
              },
              state: committedState,
              spatialChangedAggregates
            }
          }
          const nextEncounterVersion = await lockedEncounterContext.context.advanceVersion(
            lockedEncounterContext.encounter.version
          )
          const updatedEncounter = await createEncounterRepository(trx).find(encounterId)
          if (!updatedEncounter) throw new EncounterNotFoundError()
          const terminalSnapshot = await evaluateEncounterActorRuleSnapshot({
            db: trx,
            encounter: updatedEncounter
          })
          const encounterRepository = createEncounterRepository(trx)
          for (const actor of terminalSnapshot.actorUpdates)
            await encounterRepository.updateActor(actor)
          const projectionEncounter = terminalSnapshot.reconciledEncounter
          const gmProjection = projectGm(projectionEncounter, terminalSnapshot.snapshot.output)
          const currentProjection = compileEncounterCurrentProjection(
            gmProjection,
            terminalSnapshot.snapshot
          )
          await encounterRepository.publishCurrentProjection(currentProjection)
          const occurrence = await occurrences.createCompleted({
            aggregateKind: 'ENCOUNTER',
            occurrenceId,
            aggregateId: encounterId,
            campaignId: lockedEncounterContext.encounter.campaignId,
            rootCommandId: input.commandId,
            aggregateVersion: nextEncounterVersion
          })
          const terminalResult = storedRuleExecutionResultDtoSchema.parse({
            ...spatial.result,
            encounterVersion: nextEncounterVersion,
            sceneVersion: committed.version
          })
          if (
            terminalResult.status !== 'MOVEMENT_COMPLETE' &&
            (terminalResult.status !== 'BATCH_COMPLETE' ||
              terminalResult.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
          )
            throw new EncounterConflictError('Spatial movement result is unavailable.')
          const changedAggregates = terminalMovementChangedAggregates({
            encounter: { id: encounterId },
            result: terminalResult,
            expectedEncounterVersion: input.expectedEncounterVersion,
            expectedSceneVersion: input.expectedSceneVersion,
            sourceCommandId: input.commandId
          })
          await occurrences.appendReceipt({
            aggregateKind: 'ENCOUNTER',
            aggregateId: encounterId,
            commandId: input.commandId,
            commandFingerprint,
            occurrenceId,
            aggregateVersion: nextEncounterVersion,
            commandType: input.type,
            actorUserId: userId,
            correlationId: input.correlationId,
            commandMetadata: {
              schemaVersion: 1,
              transition: 'SPATIAL_MOVEMENT',
              commandType: 'MOVE_SCENE_TOKEN',
              rootCommandId: input.commandId,
              rootCommandFingerprint: commandFingerprint,
              rootInitiatorUserId: userId,
              rootCorrelationId: input.correlationId,
              encounterId,
              sceneId: scene.state.id,
              tokenId: input.tokenId,
              movementKind: input.movementKind,
              expectedEncounterVersion: input.expectedEncounterVersion,
              expectedSceneVersion: input.expectedSceneVersion,
              rootExpectedEncounterVersion: input.expectedEncounterVersion,
              rootExpectedSceneVersion: input.expectedSceneVersion,
              encounterVersionTransition: 'ADVANCED',
              sceneVersionTransition:
                committed.version === input.expectedSceneVersion ? 'UNCHANGED' : 'ADVANCED',
              currentnessChecksum: spatial.currentnessChecksum,
              selectionChecksum: spatial.selectionChecksum,
              occurrenceVersion: occurrence.version,
              changedAggregates,
              resolutionCommands: []
            },
            resultPayload: terminalResult
          })
          const occurrenceSummary = projectEncounterSpatialOccurrenceSummary(
            occurrence,
            nextEncounterVersion,
            {
              membershipRole: 'OWNER',
              assignedCharacterId: null
            }
          )
          const encounterCommand = {
            projection: gmProjection,
            roll: null,
            resolution: null,
            occurrence: occurrenceSummary
          }
          await encounterRepository.appendEvent({
            id: randomUUID(),
            encounterId,
            campaignId: projectionEncounter.campaignId,
            version: nextEncounterVersion,
            commandId: input.commandId,
            commandType: input.type,
            commandFingerprint,
            commandPayload: input as unknown as Json,
            resultPayload: encounterProjectionEventSchema.parse({
              command: encounterCommand,
              currentProjection,
              ruleReceipt: {
                occurrenceId,
                resultChecksum: checksumCanonicalJson(terminalResult)
              }
            }) as unknown as Json,
            actorUserId: userId,
            correlationId: input.correlationId
          })
          return {
            result: {
              commandId: input.commandId,
              delta: committedDelta,
              occurrence: occurrenceSummary,
              replayed: false,
              sceneId: scene.state.id,
              version: committedState.version
            },
            state: committedState,
            spatialChangedAggregates: changedAggregates,
            spatialTerminalResult: terminalResult
          }
        }
      }
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
    const projection = compileSceneCurrentProjection(nextState)
    let published: boolean
    if (liveContext) {
      published = await repository.publishLiveCommand({
        commandFingerprint,
        commandType: input.type,
        encounterId,
        event,
        eventId: randomUUID(),
        expectedVersion: scene.state.version,
        projection
      })
    } else {
      await repository.appendEvent({
        commandFingerprint,
        commandType: input.type,
        encounterId,
        event,
        id: randomUUID()
      })
      published = await repository.updateProjection({
        expectedVersion: scene.state.version,
        projection
      })
    }
    if (!published) {
      throw new EncounterConflictError('Scene changed before this command completed.')
    }
    return {
      result: {
        commandId: event.commandId,
        delta: event.delta,
        occurrence: null,
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
  explorationDeltasFor,
  legacyVisualOnlyDarknessFingerprint,
  filterExecutableMovementPassageOptions,
  nextMovementTimelineBoundaryDistance,
  sceneCommandFingerprint,
  sliceMovementPath
}
