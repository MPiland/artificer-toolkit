import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  ServerKernelRuleExecutionPendingSnapshotDto,
  StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  movementReactionActionEvidenceCommandDtoSchema,
  movementRuleResolutionCommandDtoSchema,
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  storedRuleExecutionResultDtoSchema
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { MovementReactionTimelineDto } from '@artificer-toolkit/schema/shared/reaction'
import type { SceneGrid, SpatialSceneToken } from '@artificer-toolkit/shared/vtt'
import {
  compareSpatialMovementCandidates,
  effectiveSpatialGeometry,
  spatialGeometryOverlapsTokenFootprint,
  type ScenePoint,
  type SpatialMovementCandidate,
  type SpatialMovementKind
} from '@artificer-toolkit/shared/vtt'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { z } from 'zod'

import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  reconstructTargetBoundActiveRuleEffectCompletion,
  resumeTargetBoundActiveRuleEffectWithAnswer,
  type TargetBoundActiveRuleEffectExecutionPaused,
  type TargetBoundActiveRuleEffectExecutionInput,
  type TargetBoundActiveRuleEffectExecutionResult
} from './targetBoundActiveRuleEffectExecutor.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  settleAutomaticSpatialEvidence,
  spatialCandidateEvidence,
  spatialExecutionInput,
  spatialExecutionOutcome,
  spatialExecutionStopsMovement,
  toSpatialInstances,
  type SpatialD20Roll,
  type SpatialMovementTarget,
  type SpatialTargetState
} from './encounterSpatialCandidateExecution.js'
import { zoneMovementContacts } from './encounterZoneContacts.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { checksumSpatialCurrentness } from './encounterSpatialMovementCurrentness.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
export { checksumSpatialCurrentness } from './encounterSpatialMovementCurrentness.js'

type SpatialBatch = Extract<
  StoredRuleExecutionResultDto,
  { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
>
type SpatialExecution = SpatialBatch['executions'][number]
type MovementComplete = Extract<StoredRuleExecutionResultDto, { status: 'MOVEMENT_COMPLETE' }>
type SpatialMovementTerminalResult = SpatialBatch | MovementComplete
type PendingContext = Extract<
  ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
>

const pointSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite()
})
type SpatialMovementEncounter = Pick<
  EncounterRunState,
  'id' | 'version' | 'automationMode' | 'turnSequence' | 'zoneApplications'
> & {
  actors: readonly EncounterRunActorState[]
}

export type SpatialMovementRuleRoot = {
  commandId: string
  commandFingerprint: string
  initiatorUserId: string
  correlationId: string | null
  encounterId: string
  sceneId: string
  tokenId: string
  expectedEncounterVersion: number
  expectedSceneVersion: number
  movementKind: SpatialMovementKind
  originalPath: readonly ScenePoint[]
  terminalPassageStop?: {
    blockerActorId: string
    blockerTokenId: string
    contact: ScenePoint
    pathDistance: number
    blockerCurrentnessChecksum: string
  } | null
}

/**
 * An answer to the pending spatial contact: d20 faces (entered dice or the roller's app roll) for
 * its save, or one integer for a die of the zone's damage.
 */
type SpatialMovementRuleResolution = Extract<
  EncounterEvidenceAnswer,
  { kind: 'ENTER_DICE' | 'ENTER_INTEGER' | 'SYSTEM_ROLL' }
>
type SpatialResolutionCommand = z.infer<typeof movementReactionActionEvidenceCommandDtoSchema>
type MovementRuleResolutionCommand = z.infer<typeof movementRuleResolutionCommandDtoSchema>
type MovementReactionPendingContext = Extract<
  ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
>
type MovementReactionSpatialPendingRemainder = Pick<
  FrozenMovementReactionRemainder,
  | 'spatialSelectionChecksum'
  | 'spatialCurrentnessChecksum'
  | 'appliedSpatialPrefix'
  | 'completedReactionExecutions'
  | 'reactionTimeline'
>
export type FrozenMovementReactionRemainder = Pick<
  MovementReactionPendingContext,
  | 'root'
  | 'spatialSelectionChecksum'
  | 'spatialCurrentnessChecksum'
  | 'completedSpatialExecutions'
  | 'appliedSpatialPrefix'
  | 'completedReactionExecutions'
  | 'remainingSpatialCandidates'
  | 'reactionTimeline'
> & {
  currentSpatialCandidate:
    | Extract<
        MovementReactionPendingContext['phase'],
        { kind: 'SPATIAL_EVIDENCE' }
      >['currentCandidate']
    | null
}

/** A mover leaving the area of a zone that holds a condition on it until it does (D146). */
export type MovementAreaDeparture = {
  zoneEffectId: string
  holderActorId: string
  pathDistance: number
}

/** A voluntary move that ended an effect on its mover, which holds it until the mover moves. */
export type MovementEffectEnd = {
  effectId: string
  holderActorId: string
}

export type SpatialMovementIntent = {
  tokenId: string
  position: ScenePoint
}

export type SpatialMovementRuleEvaluation =
  | { kind: 'NO_CANDIDATES'; movementIntent: SpatialMovementIntent | null }
  | { kind: 'MANUAL'; movementIntent: SpatialMovementIntent | null }
  | {
      kind: 'PENDING'
      pendingSnapshot: ServerKernelRuleExecutionPendingSnapshotDto
      movementIntent: SpatialMovementIntent | null
    }
  | {
      kind: 'REACTION_BOUNDARY'
      /** A caller must settle this holder-affecting contact (damage or a condition) before evaluating even a same-position suffix. */
      concentrationExecutionOrdinal?: number
      boundaryDistance: number
      boundaryPosition: ScenePoint
      movementIntent: SpatialMovementIntent | null
      completedExecutions: readonly SpatialExecution[]
      appliedPrefix: SpatialBatch | null
      completedReactionExecutions: MovementReactionPendingContext['completedReactionExecutions']
      remainingCandidates: PendingContext['remainingCandidates']
      resolutionCommands: readonly MovementRuleResolutionCommand[]
      selectionChecksum: string
      currentnessChecksum: string
    }
  | {
      kind: 'TERMINAL'
      result: SpatialMovementTerminalResult
      /** The held zones the mover left on its way, each ending what that zone held on it (D146). */
      areaDepartures: readonly MovementAreaDeparture[]
      /** The effects the mover held until it moved, which this voluntary move ends. */
      moveEnds: readonly MovementEffectEnd[]
      movementIntent: SpatialMovementIntent | null
      resolutionCommands: readonly MovementRuleResolutionCommand[]
      selectionChecksum: string
      currentnessChecksum: string
    }

/**
 * In-memory coordinator for a full spatial contact batch. The caller owns
 * occurrence persistence, root locks, Scene child events, and replay. This
 * service intentionally stages all target/root changes until its terminal
 * result so a paused Assisted occurrence has no partially applied mechanics.
 */
export async function evaluateEncounterSpatialMovementRuleBatch(input: {
  actorUserId: string
  autoRoll: EncounterAutoRollByActorId
  encounter: SpatialMovementEncounter
  sceneId: string
  sceneVersion: number
  actorIdByTokenId: ReadonlyMap<string, string>
  sceneTokens: readonly SpatialSceneToken[]
  /** The Scene's grid, which measures distance moved inside a zone acting per distance moved. */
  sceneGrid: SceneGrid
  spatialScope: {
    snapshot(): Promise<EncounterSpatialRuleEffectRecord[]>
    lockById(input: { id: string }): Promise<EncounterSpatialRuleEffectRecord | null>
  }
  loadTargets(actorIds: readonly string[]): Promise<ReadonlyMap<string, SpatialMovementTarget>>
  applyTerminal(input: {
    root: SpatialMovementRuleRoot
    effects: ReadonlyMap<string, EncounterSpatialRuleEffectRecord>
    applications: ReadonlyMap<string, readonly CharacterRuleActionApplication[]>
    executions: readonly SpatialExecution[]
    appliedSpatialPrefix: SpatialBatch | null
    completedReactionExecutions: FrozenMovementReactionRemainder['completedReactionExecutions']
    terminalPosition?: ScenePoint
  }): Promise<SpatialBatch>
  root: SpatialMovementRuleRoot
  currentPosition: ScenePoint
  occurrenceId: string
  executionCommandId: string
  occurrenceVersion?: number
  runtime?: RulesRuntimeService
  pendingSnapshot?: ServerKernelRuleExecutionPendingSnapshotDto
  /** Exact server-sealed movement remainder after a reaction choice settles. */
  frozenReactionRemainder?: FrozenMovementReactionRemainder
  /** Server-discovered reactions retained when spatial evidence pauses before their first boundary. */
  initialReactionTimeline?: MovementReactionTimelineDto
  resolution?: SpatialMovementRuleResolution
  resolutionCommand?: SpatialResolutionCommand
  /** Zero-based random integer below `maxExclusive`, for every die the server rolls. */
  random: (maxExclusive: number) => number
  /**
   * The voluntary mover chose to move carefully: a field that allows passage at half speed raises no
   * contact, so it asks for no save. Every call for one move supplies its saved command's choice.
   */
  carefully?: boolean
  /**
   * The tokens the mover drags (D105). Each walks the mover's path from its own place as a FORCED
   * move, so the zones it crosses settle on it in this same pass (D170).
   */
  draggedTokenIds?: readonly string[]
  beforeTerminalApply?: () => Promise<void>
  /** Stages, but does not apply, every spatial candidate through this contact. */
  interruptAfterPathDistance?: number
  /** The zones holding a condition on each actor until it leaves their area (D146). */
  leavingAreaHolds?: readonly { actorId: string; zoneEffectId: string }[]
  /** The effects each actor holds until it moves (`ON_MOVE`). */
  moveEndHolds?: readonly { actorId: string; effectId: string }[]
  interruptAfterContactToActorIds?: ReadonlySet<string>
}): Promise<SpatialMovementRuleEvaluation> {
  const root = normalizeRoot(input.root)
  let interruptAfterPathDistance = normalizeInterruptDistance(
    root,
    input.interruptAfterPathDistance
  )
  if (root.encounterId !== input.encounter.id || root.sceneId !== input.sceneId)
    throw new EncounterConflictError(
      'The spatial movement root does not match the locked Encounter Scene.'
    )
  if (
    root.expectedEncounterVersion !== input.encounter.version &&
    !input.pendingSnapshot &&
    !input.frozenReactionRemainder
  )
    throw new EncounterConflictError('The spatial movement command is stale.')
  const movingToken = input.sceneTokens.find((token) => token.id === root.tokenId)
  if (!movingToken) throw new EncounterConflictError('The spatial movement token is stale.')
  const pendingContext = input.pendingSnapshot?.applicationContext
  const resumeContext =
    pendingContext?.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ? pendingContext : null
  const reactionResumeContext =
    pendingContext?.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
    pendingContext.phase.kind === 'SPATIAL_EVIDENCE'
      ? pendingContext
      : null
  const frozenReactionRemainder =
    input.frozenReactionRemainder ??
    (reactionResumeContext ? frozenMovementReactionRemainder(reactionResumeContext) : null)
  const appliedPrefix = frozenReactionRemainder?.appliedSpatialPrefix ?? null
  if (
    appliedPrefix &&
    (appliedPrefix.status !== 'BATCH_COMPLETE' ||
      appliedPrefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
    throw new EncounterConflictError('The applied spatial prefix is not a spatial result.')
  const appliedExecutions = appliedPrefix?.executions ?? []
  const appliedStopDistance =
    appliedExecutions.find((execution) =>
      spatialExecutionStopsMovement(execution, root.movementKind)
    )?.candidate.candidate.pathDistance ?? null
  if (
    appliedPrefix &&
    (appliedPrefix.occurrenceId !== input.occurrenceId ||
      appliedPrefix.encounterId !== root.encounterId ||
      appliedPrefix.sceneId !== root.sceneId ||
      appliedPrefix.tokenId !== root.tokenId ||
      appliedPrefix.movementKind !== root.movementKind ||
      appliedPrefix.encounterVersion > input.encounter.version + 1 ||
      checksumRuleDocument(appliedExecutions) !==
        checksumRuleDocument(
          frozenReactionRemainder!.completedSpatialExecutions.slice(0, appliedExecutions.length)
        ))
  )
    throw new EncounterConflictError(
      'The applied spatial prefix does not match its retained history.'
    )
  if (
    pendingContext &&
    pendingContext.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' &&
    !reactionResumeContext
  )
    throw new EncounterConflictError('The pending occurrence is not awaiting spatial evidence.')
  if (input.frozenReactionRemainder && input.pendingSnapshot)
    throw new EncounterValidationError(
      'A frozen movement remainder cannot also supply a pending snapshot.'
    )
  if (input.initialReactionTimeline && (input.pendingSnapshot || input.frozenReactionRemainder))
    throw new EncounterValidationError(
      'Initial movement reactions may only be supplied for fresh spatial evaluation.'
    )
  if (input.pendingSnapshot && (!input.resolution || !input.resolutionCommand))
    throw new EncounterValidationError(
      'A pending spatial occurrence requires an exact resolution command.'
    )
  if (!input.pendingSnapshot && (input.resolution || input.resolutionCommand))
    throw new EncounterValidationError(
      'A fresh spatial occurrence cannot include a resolution command.'
    )
  if (
    !resumeContext &&
    !frozenReactionRemainder &&
    root.expectedSceneVersion !== input.sceneVersion
  )
    throw new EncounterConflictError('The spatial movement Scene is stale.')
  const snapshotEffects = await input.spatialScope.snapshot()
  const pathStart = root.originalPath[0]!
  const walks = [
    { tokenId: root.tokenId, movementKind: root.movementKind, path: root.originalPath },
    ...(input.draggedTokenIds ?? []).flatMap((tokenId) => {
      const token = input.sceneTokens.find(({ id }) => id === tokenId)
      return token
        ? [
            {
              tokenId,
              movementKind: 'FORCED' as const,
              path: root.originalPath.map((point) => ({
                x: point.x + token.position.x - pathStart.x,
                y: point.y + token.position.y - pathStart.y
              }))
            }
          ]
        : []
    })
  ]
  const collect = (effects: readonly EncounterSpatialRuleEffectRecord[]) =>
    walks
      .flatMap((walk) =>
        zoneMovementContacts({
          actorIdByTokenId: input.actorIdByTokenId,
          effects: toSpatialInstances(effects, input.encounter.actors),
          movementKind: walk.movementKind,
          path: walk.path,
          grid: input.sceneGrid,
          tokens: input.sceneTokens,
          movingTokenId: walk.tokenId,
          carefully: input.carefully,
          zoneApplications: input.encounter.zoneApplications,
          turnSequence: input.encounter.turnSequence
        })
      )
      .sort(compareSpatialMovementCandidates)
      .filter((candidate) => !releasesOnExit(candidate))
  // Leaving a zone that holds a condition until then runs no graph: it ends what the zone held.
  const releasingZoneIds = new Set(
    snapshotEffects
      .filter((effect) => effect.placement.heldCondition?.endsOnLeavingArea)
      .map(({ id }) => id)
  )
  const releasesOnExit = (candidate: SpatialMovementCandidate) =>
    candidate.trigger === 'EXIT' && releasingZoneIds.has(candidate.effectId)
  const exitDistances = new Map(
    zoneMovementContacts({
      actorIdByTokenId: input.actorIdByTokenId,
      effects: toSpatialInstances(
        snapshotEffects.filter(({ id }) => releasingZoneIds.has(id)),
        input.encounter.actors
      ),
      movementKind: root.movementKind,
      path: root.originalPath,
      grid: input.sceneGrid,
      tokens: input.sceneTokens,
      movingTokenId: root.tokenId,
      turnSequence: input.encounter.turnSequence
    }).flatMap((candidate) =>
      releasesOnExit(candidate)
        ? [[`${candidate.effectId}:${candidate.targetActorId}`, candidate.pathDistance] as const]
        : []
    )
  )
  const moverActorId = input.actorIdByTokenId.get(root.tokenId)
  /**
   * The zones the mover leaves by a move that ends at `stopDistance` (or at its end, when null):
   * its footprint there is outside the area. A creature stopped on entering only touches the edge,
   * so it leaves without an exit contact, at the move's start.
   */
  const departedBy = (stopDistance: number | null): MovementAreaDeparture[] => {
    const at =
      stopDistance === null
        ? root.originalPath.at(-1)
        : pathPointAtDistance(root.originalPath, stopDistance)
    if (!at || !moverActorId) return []
    return (input.leavingAreaHolds ?? []).flatMap((hold) => {
      const zone = snapshotEffects.find(({ id }) => id === hold.zoneEffectId)
      const geometry =
        zone && releasingZoneIds.has(zone.id)
          ? effectiveSpatialGeometry(
              toSpatialInstances([zone], input.encounter.actors)[0]!,
              input.sceneTokens
            )
          : null
      if (
        hold.actorId !== moverActorId ||
        !geometry ||
        spatialGeometryOverlapsTokenFootprint({ geometry, position: at, token: movingToken })
      )
        return []
      return [
        {
          zoneEffectId: hold.zoneEffectId,
          holderActorId: hold.actorId,
          pathDistance: exitDistances.get(`${hold.zoneEffectId}:${hold.actorId}`) ?? 0
        }
      ]
    })
  }
  /** A voluntary move of any length ends what its mover holds until it moves. */
  const movedEnds = (): MovementEffectEnd[] =>
    root.movementKind === 'VOLUNTARY' && moverActorId
      ? (input.moveEndHolds ?? [])
          .filter((hold) => hold.actorId === moverActorId)
          .map((hold) => ({ effectId: hold.effectId, holderActorId: hold.actorId }))
      : []
  const candidates = frozenReactionRemainder
    ? frozenSpatialCandidates(frozenReactionRemainder, appliedExecutions.length)
    : collect(snapshotEffects)
  const computedSelectionChecksum = checksumSpatialMovementSelection({
    encounterId: input.encounter.id,
    sceneId: input.sceneId,
    tokenId: root.tokenId,
    movementKind: root.movementKind,
    path: root.originalPath,
    candidates
  })
  const selectionChecksum =
    frozenReactionRemainder?.spatialSelectionChecksum ?? computedSelectionChecksum
  if (
    frozenReactionRemainder &&
    frozenReactionRemainder.appliedSpatialPrefix === null &&
    computedSelectionChecksum !== selectionChecksum
  )
    throw new EncounterConflictError('The frozen spatial candidate selection is stale.')
  const retainedTerminalPosition =
    appliedStopDistance === null
      ? root.originalPath.at(-1)!
      : pathPointAtDistance(root.originalPath, appliedStopDistance)!
  const terminalIntent = intent(root.tokenId, input.currentPosition, retainedTerminalPosition)
  if (resumeContext)
    verifyResumeRoot({
      context: resumeContext,
      root,
      selectionChecksum,
      currentPosition: input.currentPosition,
      sceneVersion: input.sceneVersion
    })
  if (frozenReactionRemainder)
    verifyFrozenReactionRoot({
      context: frozenReactionRemainder,
      root,
      currentPosition: input.currentPosition,
      sceneVersion: input.sceneVersion
    })
  const resolutionCommands =
    resumeContext || reactionResumeContext
      ? appendResolutionCommand({
          history: (resumeContext ?? reactionResumeContext)!.root.resolutionCommands,
          command: input.resolutionCommand!,
          resolution: input.resolution!,
          actorUserId: input.actorUserId,
          proposedOccurrenceVersion: input.occurrenceVersion
        })
      : frozenReactionRemainder
        ? [...frozenReactionRemainder.root.resolutionCommands]
        : []
  if (resumeContext)
    verifyPendingCandidateSelection({
      context: resumeContext,
      candidates,
      effects: snapshotEffects
    })
  if ((resumeContext || frozenReactionRemainder) && input.encounter.automationMode === 'MANUAL')
    throw new EncounterConflictError('A pending spatial occurrence cannot resume in Manual mode.')
  if (input.encounter.automationMode === 'MANUAL')
    return { kind: 'MANUAL', movementIntent: terminalIntent }
  if (candidates.length === 0) {
    const currentnessChecksum = checksumSpatialCurrentness({
      encounter: input.encounter,
      candidates: []
    })
    if (
      frozenReactionRemainder &&
      frozenReactionRemainder.spatialCurrentnessChecksum !== currentnessChecksum
    )
      throw new EncounterConflictError('The frozen spatial currentness facts are stale.')
    if (
      interruptAfterPathDistance !== null &&
      (appliedStopDistance === null || interruptAfterPathDistance <= appliedStopDistance + 1e-8)
    ) {
      const boundaryPosition = pathPointAtDistance(root.originalPath, interruptAfterPathDistance)!
      return {
        kind: 'REACTION_BOUNDARY',
        boundaryDistance: interruptAfterPathDistance,
        boundaryPosition,
        movementIntent: intent(root.tokenId, input.currentPosition, boundaryPosition),
        completedExecutions: appliedExecutions,
        appliedPrefix,
        completedReactionExecutions: frozenReactionRemainder?.completedReactionExecutions ?? [],
        remainingCandidates: [],
        resolutionCommands,
        selectionChecksum,
        currentnessChecksum
      }
    }
    const areaDepartures = departedBy(appliedStopDistance)
    const moveEnds = movedEnds()
    if (!frozenReactionRemainder && !areaDepartures.length && !moveEnds.length)
      return { kind: 'NO_CANDIDATES', movementIntent: terminalIntent }
    if (appliedPrefix) await input.beforeTerminalApply?.()
    const result = appliedPrefix
      ? await input.applyTerminal({
          root,
          effects: new Map(),
          applications: new Map(),
          executions: [],
          appliedSpatialPrefix: appliedPrefix,
          completedReactionExecutions: frozenReactionRemainder?.completedReactionExecutions ?? [],
          terminalPosition: retainedTerminalPosition
        })
      : completeMovementWithoutSpatial({ input, root })
    return {
      kind: 'TERMINAL',
      result,
      areaDepartures,
      moveEnds,
      movementIntent: terminalIntent,
      resolutionCommands,
      selectionChecksum,
      currentnessChecksum
    }
  }
  if (!input.runtime)
    throw new EncounterValidationError('A Rules runtime is required for spatial effects.')

  const actorById = new Map(input.encounter.actors.map((actor) => [actor.id, actor]))
  const candidateActors = candidates.map((candidate) => {
    const actor = actorById.get(candidate.targetActorId)
    if (!actor)
      throw new EncounterConflictError('A spatial effect target is no longer in the Encounter.')
    return actor
  })
  const targetActorIds = [...new Set(candidateActors.map((actor) => actor.id))]
  const targets = await input.loadTargets(targetActorIds)
  for (const actorId of targetActorIds) {
    if (!targets.has(actorId)) throw new EncounterConflictError('The spatial target is stale.')
  }
  const snapshotById = new Map(snapshotEffects.map((effect) => [effect.id, effect]))
  const lockedEffects = new Map<string, EncounterSpatialRuleEffectRecord>()
  for (const effectId of [...new Set(candidates.map((candidate) => candidate.effectId))].sort()) {
    const snapshot = snapshotById.get(effectId)
    const effect = await input.spatialScope.lockById({ id: effectId })
    if (!snapshot || !effect || !sameSpatialRoot(snapshot, effect))
      throw new EncounterConflictError('A spatial root changed before execution.')
    lockedEffects.set(effectId, effect)
  }
  const lockedCandidates = frozenReactionRemainder
    ? candidates
    : collect([...lockedEffects.values()])
  if (checksumRuleDocument(lockedCandidates) !== checksumRuleDocument(candidates))
    throw new EncounterConflictError('Spatial candidates changed after target locking.')
  // This is deliberately derived only after every spatial root and target
  // currentness fact is locked.  The public Scene command must never rebuild
  // receipt currentness from its submitted path or an unlocked projection.
  const currentnessChecksum = checksumSpatialCurrentness({
    encounter: input.encounter,
    candidates: candidates.map((candidate, ordinal) => {
      const effect = lockedEffects.get(candidate.effectId)!
      const target = targets.get(candidate.targetActorId)!
      return pendingCandidate({
        ordinal: appliedExecutions.length + ordinal,
        candidate,
        effect,
        target,
        state: target.state,
        d20Policy: null,
        diceStage: null
      })
    })
  })
  if (
    frozenReactionRemainder &&
    frozenReactionRemainder.appliedSpatialPrefix === null &&
    frozenReactionRemainder.spatialCurrentnessChecksum !== currentnessChecksum
  )
    throw new EncounterConflictError('The frozen spatial currentness facts are stale.')
  const states = new Map(
    [...targets.entries()].map(([actorId, target]) => [actorId, copyState(target.state)])
  )
  const applications = new Map<string, CharacterRuleActionApplication[]>()
  const executions: SpatialExecution[] = []
  const completedPrefix =
    resumeContext?.completedExecutions ??
    frozenReactionRemainder?.completedSpatialExecutions.slice(appliedExecutions.length) ??
    []
  const pendingSpatialCandidate =
    resumeContext?.currentCandidate ?? frozenReactionRemainder?.currentSpatialCandidate ?? null
  let stopAtDistance: number | null = appliedStopDistance
  let concentrationExecutionOrdinal: number | undefined

  for (const [candidateIndex, candidate] of candidates.entries()) {
    const ordinal = appliedExecutions.length + candidateIndex
    if (stopAtDistance !== null && candidate.pathDistance > stopAtDistance + 1e-8) break
    if (
      interruptAfterPathDistance !== null &&
      candidate.pathDistance > interruptAfterPathDistance + 1e-8
    )
      break
    const effect = lockedEffects.get(candidate.effectId)
    const target = targets.get(candidate.targetActorId)
    if (!effect || !target)
      throw new EncounterConflictError('A spatial contact changed before execution.')
    const state = states.get(candidate.targetActorId)!
    const sealed =
      completedPrefix[candidateIndex]?.candidate ??
      (pendingSpatialCandidate && ordinal === pendingSpatialCandidate.ordinal
        ? pendingSpatialCandidate
        : null)
    const currentCandidate = pendingCandidate({
      ordinal,
      candidate,
      effect,
      target,
      state,
      d20Policy: sealed?.d20Policy ?? null,
      diceStage: sealed?.diceStage ?? null
    })
    const effectInput = spatialExecutionInput({
      effect,
      target,
      state,
      occurrenceId: input.occurrenceId,
      runtime: input.runtime
    })
    const stored = completedPrefix[candidateIndex]
    if (stored) {
      const reconstructed = reconstructTargetBoundActiveRuleEffectCompletion({
        executionInput: effectInput,
        execution: stored.execution,
        d20Evidence: stored.d20
      })
      const rebuilt = completeExecution({
        ordinal,
        pending: currentCandidate,
        target,
        state,
        result: reconstructed
      })
      if (checksumRuleDocument(rebuilt) !== checksumRuleDocument(stored))
        throw new EncounterConflictError('The completed spatial execution cannot be reconstructed.')
      stageExecution({ execution: rebuilt, states, applications, executions })
      if (spatialExecutionStopsMovement(rebuilt, root.movementKind)) {
        stopAtDistance ??= candidate.pathDistance
      }
      continue
    }
    if (pendingSpatialCandidate) {
      if (ordinal < pendingSpatialCandidate.ordinal)
        throw new EncounterConflictError('The spatial completed prefix is incomplete.')
      if (ordinal === pendingSpatialCandidate.ordinal) {
        if (!samePendingCandidate(currentCandidate, pendingSpatialCandidate))
          throw new EncounterConflictError('The current spatial contact is stale.')
      } else {
        const remainingCandidates =
          resumeContext?.remainingCandidates ??
          reactionResumeContext?.remainingSpatialCandidates ??
          []
        const expected = remainingCandidates[ordinal - pendingSpatialCandidate.ordinal - 1]
        if (!expected || !sameRemainingPendingCandidate(currentCandidate, expected))
          throw new EncounterConflictError('The remaining spatial contacts changed.')
      }
    } else if (frozenReactionRemainder) {
      const expected =
        frozenReactionRemainder.remainingSpatialCandidates[candidateIndex - completedPrefix.length]
      if (!expected || !sameRemainingPendingCandidate(currentCandidate, expected))
        throw new EncounterConflictError('The frozen spatial contact suffix is stale.')
    }
    let d20: SpatialD20Roll | null = null
    let result:
      | TargetBoundActiveRuleEffectExecutionResult
      | TargetBoundActiveRuleEffectExecutionPaused
    if (pendingSpatialCandidate && ordinal === pendingSpatialCandidate.ordinal) {
      const resumed = await resumeSpatial({
        effectInput,
        pendingSnapshot: input.pendingSnapshot!,
        pending: pendingSpatialCandidate,
        resolution: input.resolution!,
        random: input.random
      })
      result = resumed.result
      d20 = resumed.d20
    } else {
      result = await executeTargetBoundActiveRuleEffectWithPause(effectInput)
    }
    ;({ result, d20 } = await settleAutomaticSpatialEvidence({
      effectInput,
      candidate,
      result,
      d20,
      autoRoll: input.autoRoll,
      random: input.random
    }))
    if ('continuation' in result) {
      const contactPosition = pathPointAtDistance(root.originalPath, candidate.pathDistance)
      if (!contactPosition)
        throw new EncounterConflictError('The spatial contact has no authoritative path position.')
      const pendingCurrent = pendingCandidate({
        ordinal,
        candidate,
        effect,
        target,
        state,
        d20Policy: result.evidencePolicy,
        diceStage: d20
      })
      const pendingRemaining = candidates.slice(candidateIndex + 1).map((remaining, offset) => {
        const remainingEffect = lockedEffects.get(remaining.effectId)!
        const remainingTarget = targets.get(remaining.targetActorId)!
        return pendingCandidate({
          ordinal: ordinal + offset + 1,
          candidate: remaining,
          effect: remainingEffect,
          target: remainingTarget,
          state: states.get(remaining.targetActorId)!,
          d20Policy: null,
          diceStage: null
        })
      })
      const currentSceneVersion =
        input.sceneVersion + (intent(root.tokenId, input.currentPosition, contactPosition) ? 1 : 0)
      const reactionRemainder: MovementReactionSpatialPendingRemainder | null =
        (frozenReactionRemainder &&
        (frozenReactionRemainder.reactionTimeline.length || appliedPrefix)
          ? frozenReactionRemainder
          : null) ??
        (input.initialReactionTimeline?.length
          ? {
              spatialSelectionChecksum: selectionChecksum,
              spatialCurrentnessChecksum: currentnessChecksum,
              appliedSpatialPrefix: null,
              completedReactionExecutions: [],
              reactionTimeline: input.initialReactionTimeline
            }
          : null)
      const nextPendingSnapshot = reactionRemainder
        ? movementReactionSpatialPendingSnapshot({
            paused: result,
            reactionRemainder,
            root,
            completedExecutions: [...appliedExecutions, ...executions],
            current: pendingCurrent,
            remaining: pendingRemaining,
            resolutionCommands,
            pathStartDistance: candidate.pathDistance,
            currentPosition: contactPosition,
            currentSceneVersion
          })
        : pendingSnapshot({
            paused: result,
            root,
            selectionChecksum,
            completedExecutions: executions,
            current: pendingCurrent,
            remaining: pendingRemaining,
            occurrenceId: input.occurrenceId,
            resolutionCommands,
            pathStartDistance: candidate.pathDistance,
            currentPosition: contactPosition,
            currentSceneVersion
          })
      return {
        kind: 'PENDING',
        movementIntent: intent(root.tokenId, input.currentPosition, contactPosition),
        pendingSnapshot: nextPendingSnapshot
      }
    }
    const completed = completeExecution({
      ordinal,
      pending: currentCandidate,
      target,
      state,
      result
    })
    stageExecution({ execution: completed, states, applications, executions })
    if (spatialExecutionStopsMovement(completed, root.movementKind)) {
      stopAtDistance ??= candidate.pathDistance
    }
    if (
      input.interruptAfterContactToActorIds?.has(candidate.targetActorId) &&
      completed.applications.some(
        (application) =>
          (application.kind === 'DAMAGE' && application.appliedAmount > 0) ||
          (application.kind === 'CONDITION_APPLY' && application.applied)
      )
    ) {
      interruptAfterPathDistance = candidate.pathDistance
      concentrationExecutionOrdinal = completed.ordinal
      break
    }
  }

  if (
    interruptAfterPathDistance !== null &&
    (stopAtDistance === null || interruptAfterPathDistance <= stopAtDistance + 1e-8)
  ) {
    const boundaryPosition = pathPointAtDistance(root.originalPath, interruptAfterPathDistance)!
    const nextOrdinal = appliedExecutions.length + executions.length
    return {
      kind: 'REACTION_BOUNDARY',
      ...(concentrationExecutionOrdinal === undefined ? {} : { concentrationExecutionOrdinal }),
      boundaryDistance: interruptAfterPathDistance,
      boundaryPosition,
      movementIntent: intent(root.tokenId, input.currentPosition, boundaryPosition),
      completedExecutions: [...appliedExecutions, ...executions],
      // Retain already-published history while staging only the new spatial suffix.
      appliedPrefix,
      completedReactionExecutions: frozenReactionRemainder?.completedReactionExecutions ?? [],
      remainingCandidates: candidates.slice(executions.length).map((remaining, offset) => {
        const remainingEffect = lockedEffects.get(remaining.effectId)!
        const remainingTarget = targets.get(remaining.targetActorId)!
        return pendingCandidate({
          ordinal: nextOrdinal + offset,
          candidate: remaining,
          effect: remainingEffect,
          target: remainingTarget,
          state: states.get(remaining.targetActorId)!,
          d20Policy: null,
          diceStage: null
        })
      }),
      resolutionCommands,
      selectionChecksum,
      currentnessChecksum
    }
  }

  await input.beforeTerminalApply?.()
  const terminalPosition =
    stopAtDistance === null
      ? root.originalPath.at(-1)!
      : pathPointAtDistance(root.originalPath, stopAtDistance)
  if (!terminalPosition)
    throw new EncounterConflictError(
      'The movement interruption has no authoritative path position.'
    )
  const result = await input.applyTerminal({
    root,
    effects: lockedEffects,
    applications,
    executions,
    appliedSpatialPrefix: appliedPrefix,
    completedReactionExecutions: frozenReactionRemainder?.completedReactionExecutions ?? [],
    terminalPosition
  })
  return {
    kind: 'TERMINAL',
    result,
    areaDepartures: departedBy(stopAtDistance),
    moveEnds: movedEnds(),
    movementIntent: intent(root.tokenId, input.currentPosition, terminalPosition),
    resolutionCommands,
    selectionChecksum,
    currentnessChecksum
  }
}

function frozenMovementReactionRemainder(
  context: MovementReactionPendingContext
): FrozenMovementReactionRemainder {
  return {
    root: context.root,
    spatialSelectionChecksum: context.spatialSelectionChecksum,
    spatialCurrentnessChecksum: context.spatialCurrentnessChecksum,
    completedSpatialExecutions: context.completedSpatialExecutions,
    appliedSpatialPrefix: context.appliedSpatialPrefix,
    completedReactionExecutions: context.completedReactionExecutions,
    currentSpatialCandidate:
      context.phase.kind === 'SPATIAL_EVIDENCE' ? context.phase.currentCandidate : null,
    remainingSpatialCandidates: context.remainingSpatialCandidates,
    reactionTimeline: context.reactionTimeline
  }
}

function frozenSpatialCandidates(
  context: FrozenMovementReactionRemainder,
  appliedExecutionCount: number
): SpatialMovementCandidate[] {
  return [
    ...context.completedSpatialExecutions
      .slice(appliedExecutionCount)
      .map((execution) => execution.candidate.candidate),
    ...(context.currentSpatialCandidate ? [context.currentSpatialCandidate.candidate] : []),
    ...context.remainingSpatialCandidates.map((candidate) => candidate.candidate)
  ]
}

function checksumSpatialMovementSelection(input: {
  encounterId: string
  sceneId: string
  tokenId: string
  movementKind: SpatialMovementKind
  path: readonly ScenePoint[]
  candidates: readonly unknown[]
}): string {
  return checksumRuleDocument(input)
}

function verifyFrozenReactionRoot(input: {
  context: Pick<FrozenMovementReactionRemainder, 'root'>
  root: SpatialMovementRuleRoot
  currentPosition: ScenePoint
  sceneVersion: number
}) {
  const context = input.context
  if (
    context.root.commandId !== input.root.commandId ||
    context.root.commandFingerprint !== input.root.commandFingerprint ||
    context.root.initiatorUserId !== input.root.initiatorUserId ||
    context.root.correlationId !== input.root.correlationId ||
    context.root.encounterId !== input.root.encounterId ||
    context.root.sceneId !== input.root.sceneId ||
    context.root.tokenId !== input.root.tokenId ||
    context.root.movementKind !== input.root.movementKind ||
    context.root.expectedEncounterVersion !== input.root.expectedEncounterVersion ||
    context.root.expectedSceneVersion !== input.root.expectedSceneVersion ||
    context.root.currentSceneVersion !== input.sceneVersion ||
    checksumRuleDocument(context.root.originalPath) !==
      checksumRuleDocument(input.root.originalPath) ||
    checksumRuleDocument(context.root.terminalPassageStop ?? null) !==
      checksumRuleDocument(input.root.terminalPassageStop ?? null) ||
    !samePoint(context.root.currentPosition, input.currentPosition)
  )
    throw new EncounterConflictError('The frozen movement reaction root is stale.')
}

function normalizeRoot(root: SpatialMovementRuleRoot): SpatialMovementRuleRoot {
  if (root.originalPath.length < 2)
    throw new EncounterValidationError('Spatial movement needs a path.')
  if (root.movementKind === 'TELEPORT' && root.originalPath.length !== 2)
    throw new EncounterValidationError('Teleport movement needs only origin and destination.')
  return {
    ...root,
    originalPath: root.originalPath.map((point) => pointSchema.parse(point))
  }
}

function normalizeInterruptDistance(
  root: SpatialMovementRuleRoot,
  value: number | undefined
): number | null {
  if (value === undefined) return null
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    pathPointAtDistance(root.originalPath, value) === null
  )
    throw new EncounterValidationError('The movement reaction boundary is outside the path.')
  return value
}

function sameSpatialRoot(
  snapshot: EncounterSpatialRuleEffectRecord,
  locked: EncounterSpatialRuleEffectRecord
): boolean {
  return (
    snapshot.id === locked.id &&
    snapshot.encounterId === locked.encounterId &&
    snapshot.sceneId === locked.sceneId &&
    snapshot.createdOrdinal === locked.createdOrdinal &&
    snapshot.version === locked.version &&
    snapshot.definitionChecksum === locked.definitionChecksum &&
    snapshot.lifecycleChecksum === locked.lifecycleChecksum &&
    snapshot.placementChecksum === locked.placementChecksum &&
    snapshot.spatialStateChecksum === locked.spatialStateChecksum
  )
}

function pendingCandidate(input: {
  ordinal: number
  candidate: SpatialMovementCandidate
  effect: EncounterSpatialRuleEffectRecord
  target: SpatialMovementTarget
  state: SpatialTargetState
  d20Policy: TargetBoundActiveRuleEffectExecutionPaused['evidencePolicy']
  diceStage: SpatialD20Roll | null
}) {
  return {
    ordinal: input.ordinal,
    candidate: input.candidate,
    ...spatialCandidateEvidence(input)
  }
}

function completeExecution(input: {
  ordinal: number
  pending: ReturnType<typeof pendingCandidate>
  target: SpatialMovementTarget
  state: SpatialTargetState
  result: TargetBoundActiveRuleEffectExecutionResult
}): SpatialExecution {
  return {
    ordinal: input.ordinal,
    candidate: input.pending,
    ...spatialExecutionOutcome({
      target: input.target,
      state: input.state,
      targetStateChecksum: input.pending.target.targetStateChecksum,
      result: input.result
    })
  }
}

function stageExecution(input: {
  execution: SpatialExecution
  states: Map<string, SpatialTargetState>
  applications: Map<string, CharacterRuleActionApplication[]>
  executions: SpatialExecution[]
}) {
  input.states.set(input.execution.candidate.candidate.targetActorId, {
    current: input.execution.targetTransition.after.currentHitPoints,
    temporary: input.execution.targetTransition.after.temporaryHitPoints,
    conditions: [...input.execution.targetTransition.after.conditionIds],
    deathSaves: input.execution.targetTransition.after.deathSaves
  })
  input.applications.set(input.execution.candidate.candidate.targetActorId, [
    ...(input.applications.get(input.execution.candidate.candidate.targetActorId) ?? []),
    ...input.execution.applications.map((application) => ({
      ...application,
      targetActorId: input.execution.candidate.candidate.targetActorId
    }))
  ])
  input.executions.push(input.execution)
}

function appendResolutionCommand(input: {
  history: readonly MovementRuleResolutionCommand[]
  command: SpatialResolutionCommand
  resolution: SpatialMovementRuleResolution
  actorUserId: string
  proposedOccurrenceVersion: number | undefined
}): MovementRuleResolutionCommand[] {
  const command = movementReactionActionEvidenceCommandDtoSchema.parse(input.command)
  const proposedOccurrenceVersion = input.proposedOccurrenceVersion
  if (
    typeof proposedOccurrenceVersion !== 'number' ||
    !Number.isInteger(proposedOccurrenceVersion) ||
    proposedOccurrenceVersion <= 0 ||
    proposedOccurrenceVersion !== input.history.length + 1 ||
    command.expectedOccurrenceVersion !== proposedOccurrenceVersion - 1 ||
    command.actorUserId !== input.actorUserId ||
    command.requestId !== input.resolution.requestId ||
    command.kind !== input.resolution.kind
  )
    throw new EncounterConflictError('The spatial resolution command is stale.')
  if (input.history.some((entry) => entry.commandId === command.commandId))
    throw new EncounterConflictError('The spatial resolution command was already used.')
  return [...input.history, command]
}

async function resumeSpatial(input: {
  effectInput: TargetBoundActiveRuleEffectExecutionInput
  pendingSnapshot: ServerKernelRuleExecutionPendingSnapshotDto
  pending: PendingContext['currentCandidate']
  resolution: SpatialMovementRuleResolution
  random: (maxExclusive: number) => number
}): Promise<{
  result: TargetBoundActiveRuleEffectExecutionResult | TargetBoundActiveRuleEffectExecutionPaused
  d20: SpatialD20Roll | null
}> {
  const {
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    applicationContext: _applicationContext,
    snapshotKind: _snapshotKind,
    ...continuation
  } = input.pendingSnapshot
  return resumeTargetBoundActiveRuleEffectWithAnswer({
    effectInput: input.effectInput,
    continuation,
    policy: input.pending.d20Policy,
    diceStage: input.pending.diceStage,
    answer: input.resolution,
    random: input.random
  })
}

function pendingSnapshot(input: {
  paused: TargetBoundActiveRuleEffectExecutionPaused
  root: SpatialMovementRuleRoot
  selectionChecksum: string
  completedExecutions: readonly SpatialExecution[]
  current: ReturnType<typeof pendingCandidate>
  remaining: readonly ReturnType<typeof pendingCandidate>[]
  occurrenceId: string
  resolutionCommands: readonly MovementRuleResolutionCommand[]
  pathStartDistance: number
  currentPosition: ScenePoint
  currentSceneVersion: number
}): ServerKernelRuleExecutionPendingSnapshotDto {
  const paused = input.paused
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    snapshotKind: 'KERNEL_EVIDENCE',
    ...paused.continuation,
    applicationContext: {
      kind: 'ENCOUNTER_SPATIAL_MOVEMENT',
      schemaVersion: 1,
      root: {
        ...input.root,
        pathChecksum: checksumRuleDocument(input.root.originalPath),
        pathStartDistance: input.pathStartDistance,
        currentPosition: input.currentPosition,
        currentSceneVersion: input.currentSceneVersion,
        resolutionCommands: input.resolutionCommands
      },
      selectionChecksum: input.selectionChecksum,
      completedExecutions: input.completedExecutions,
      currentCandidate: input.current,
      remainingCandidates: input.remaining
    }
  })
}

function movementReactionSpatialPendingSnapshot(input: {
  paused: TargetBoundActiveRuleEffectExecutionPaused
  reactionRemainder: MovementReactionSpatialPendingRemainder
  root: SpatialMovementRuleRoot
  completedExecutions: readonly SpatialExecution[]
  current: ReturnType<typeof pendingCandidate>
  remaining: readonly ReturnType<typeof pendingCandidate>[]
  resolutionCommands: readonly MovementRuleResolutionCommand[]
  pathStartDistance: number
  currentPosition: ScenePoint
  currentSceneVersion: number
}): ServerKernelRuleExecutionPendingSnapshotDto {
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    snapshotKind: 'KERNEL_EVIDENCE',
    ...input.paused.continuation,
    applicationContext: {
      kind: 'ENCOUNTER_MOVEMENT_REACTION',
      schemaVersion: 1,
      root: {
        ...input.root,
        pathChecksum: checksumRuleDocument(input.root.originalPath),
        pathStartDistance: input.pathStartDistance,
        currentPosition: input.currentPosition,
        currentSceneVersion: input.currentSceneVersion,
        resolutionCommands: input.resolutionCommands
      },
      spatialSelectionChecksum: input.reactionRemainder.spatialSelectionChecksum,
      spatialCurrentnessChecksum: input.reactionRemainder.spatialCurrentnessChecksum,
      reactionSelectionChecksum: checksumRuleDocument(input.reactionRemainder.reactionTimeline),
      completedSpatialExecutions: input.completedExecutions,
      appliedSpatialPrefix: input.reactionRemainder.appliedSpatialPrefix,
      completedReactionExecutions: input.reactionRemainder.completedReactionExecutions,
      phase: {
        kind: 'SPATIAL_EVIDENCE',
        currentCandidate: input.current
      },
      remainingSpatialCandidates: input.remaining,
      reactionTimeline: input.reactionRemainder.reactionTimeline
    }
  })
}

function verifyResumeRoot(input: {
  context: PendingContext
  root: SpatialMovementRuleRoot
  selectionChecksum: string
  currentPosition: ScenePoint
  sceneVersion: number
}) {
  const context = input.context
  if (
    context.root.commandId !== input.root.commandId ||
    context.root.commandFingerprint !== input.root.commandFingerprint ||
    context.root.initiatorUserId !== input.root.initiatorUserId ||
    context.root.correlationId !== input.root.correlationId ||
    context.root.encounterId !== input.root.encounterId ||
    context.root.sceneId !== input.root.sceneId ||
    context.root.tokenId !== input.root.tokenId ||
    context.root.movementKind !== input.root.movementKind ||
    context.root.expectedEncounterVersion !== input.root.expectedEncounterVersion ||
    context.root.expectedSceneVersion !== input.root.expectedSceneVersion ||
    context.root.currentSceneVersion !== input.sceneVersion ||
    context.selectionChecksum !== input.selectionChecksum ||
    checksumRuleDocument(context.root.originalPath) !==
      checksumRuleDocument(input.root.originalPath) ||
    !samePoint(context.root.currentPosition, input.currentPosition)
  )
    throw new EncounterConflictError('The paused spatial movement root is stale.')
}

function verifyPendingCandidateSelection(input: {
  context: PendingContext
  candidates: readonly SpatialMovementCandidate[]
  effects: readonly EncounterSpatialRuleEffectRecord[]
}) {
  const expected = [
    ...input.context.completedExecutions.map((execution) => execution.candidate),
    input.context.currentCandidate,
    ...input.context.remainingCandidates
  ]
  const effectIds = new Set(input.effects.map((effect) => effect.id))
  if (expected.length === 0 || input.candidates.length !== expected.length)
    throw new EncounterConflictError('The paused spatial candidate selection is stale.')
  for (const [index, pending] of expected.entries()) {
    const candidate = input.candidates[index]
    if (
      !candidate ||
      candidate.effectId !== pending.candidate.effectId ||
      candidate.targetActorId !== pending.candidate.targetActorId ||
      candidate.trigger !== pending.candidate.trigger ||
      candidate.step !== pending.candidate.step ||
      candidate.pathDistance !== pending.candidate.pathDistance ||
      candidate.sourceMoved !== pending.candidate.sourceMoved ||
      checksumRuleDocument(candidate.contact) !== checksumRuleDocument(pending.candidate.contact) ||
      !effectIds.has(pending.candidate.effectId)
    )
      throw new EncounterConflictError('The paused spatial candidate selection is stale.')
  }
}

function completeMovementWithoutSpatial(input: {
  input: Parameters<typeof evaluateEncounterSpatialMovementRuleBatch>[0]
  root: SpatialMovementRuleRoot
}): MovementComplete {
  const terminalIntent = intent(
    input.root.tokenId,
    input.input.currentPosition,
    input.root.originalPath.at(-1)!
  )
  const result = storedRuleExecutionResultDtoSchema.parse({
    status: 'MOVEMENT_COMPLETE',
    schemaVersion: 1,
    occurrenceId: input.input.occurrenceId,
    occurrenceVersion: input.input.occurrenceVersion ?? 0,
    encounterId: input.input.encounter.id,
    encounterVersion: input.input.encounter.version + 1,
    sceneId: input.input.sceneId,
    sceneVersion: input.input.sceneVersion + (terminalIntent ? 1 : 0),
    tokenId: input.root.tokenId,
    movementKind: input.root.movementKind,
    reactionExecutions: input.input.frozenReactionRemainder?.completedReactionExecutions ?? [],
    terminalPosition: input.root.originalPath.at(-1)!
  })
  if (result.status !== 'MOVEMENT_COMPLETE')
    throw new EncounterConflictError('Reaction-only movement result is unavailable.')
  return result
}

function copyState(state: SpatialTargetState): SpatialTargetState {
  return {
    current: state.current,
    temporary: state.temporary,
    conditions: [...state.conditions],
    deathSaves: state.deathSaves
  }
}
function samePoint(left: ScenePoint, right: ScenePoint) {
  return Math.abs(left.x - right.x) <= 1e-8 && Math.abs(left.y - right.y) <= 1e-8
}
function intent(
  tokenId: string,
  current: ScenePoint,
  position: ScenePoint
): SpatialMovementIntent | null {
  return samePoint(current, position) ? null : { tokenId, position }
}
function pathPointAtDistance(path: readonly ScenePoint[], distance: number): ScenePoint | null {
  let remaining = distance
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!
    const to = path[index]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    if (remaining <= length + 1e-8) {
      const ratio = length === 0 ? 0 : Math.max(0, Math.min(1, remaining / length))
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio
      }
    }
    remaining -= length
  }
  return Math.abs(remaining) <= 1e-8 ? path.at(-1)! : null
}
function samePendingCandidate(
  left: ReturnType<typeof pendingCandidate>,
  right: PendingContext['currentCandidate']
): boolean {
  return checksumRuleDocument(left) === checksumRuleDocument(right)
}

function sameRemainingPendingCandidate(
  left: ReturnType<typeof pendingCandidate>,
  right: PendingContext['remainingCandidates'][number]
): boolean {
  const { targetStateChecksum: _leftChecksum, ...leftTarget } = left.target
  const { targetStateChecksum: _rightChecksum, ...rightTarget } = right.target
  return (
    checksumRuleDocument({ ...left, target: leftTarget }) ===
    checksumRuleDocument({ ...right, target: rightTarget })
  )
}
