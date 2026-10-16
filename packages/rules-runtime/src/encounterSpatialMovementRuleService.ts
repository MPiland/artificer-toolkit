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
import type { CharacterDeathSaves } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import type { MovementReactionTimelineDto } from '@artificer-toolkit/schema/shared/reaction'
import type { SpatialSceneToken } from '@artificer-toolkit/shared/vtt'
import {
  collectSpatialMovementCandidates,
  type ScenePoint,
  type SpatialMovementCandidate,
  type SpatialMovementKind
} from '@artificer-toolkit/shared/vtt'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { z } from 'zod'

import { characterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  isDamageDieRequest,
  reconstructTargetBoundActiveRuleEffectCompletion,
  resumeTargetBoundActiveRuleEffectWithPause,
  type TargetBoundActiveRuleEffectExecutionPaused,
  type TargetBoundActiveRuleEffectExecutionInput,
  type TargetBoundActiveRuleEffectExecutionResult
} from './targetBoundActiveRuleEffectExecutor.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { foldCharacterMechanicsApplications } from './encounterCharacterMechanicsBatch.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { checksumSpatialCurrentness } from './encounterSpatialMovementCurrentness.js'
import { isVisibleHalfSpeedField } from './halfSpeedField.js'
import { spatialPendingRollerActorId } from './encounterSpatialPendingRoller.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'
import {
  resolveEncounterD20Answer,
  resolveEncounterIntegerAnswer,
  type EncounterD20RollMode,
  type EncounterEvidenceAnswer
} from './encounterEvidenceAnswer.js'
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
type TargetState = {
  current: number
  temporary: number
  conditions: string[]
  deathSaves: CharacterDeathSaves | null
}
export type SpatialMovementTarget = {
  actor: Pick<EncounterRunActorState, 'id' | 'kind' | 'systemId'>
  character: {
    id: string
    streamVersion: number
    projectionChecksum: string
    mechanicalContextChecksum: string
  } | null
  /** The target's effective maximum: Run-owned for creatures, live-evaluated for Characters. */
  maximumHitPoints: number
  state: TargetState
  targetDerivedFacts: Readonly<Record<string, unknown>>
  defenses: TargetBoundActiveRuleEffectExecutionInput['defenses']
  conditionImmunityIds: readonly string[]
  scalarValues: Readonly<Record<string, number>>
}
type LockedTarget = SpatialMovementTarget
type SpatialMovementEncounter = Pick<EncounterRunState, 'id' | 'version' | 'automationMode'> & {
  actors: readonly { id: string }[]
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
/** The resolved d20 of a candidate whose damage dice are being answered. */
type SpatialD20Roll = { rollMode: EncounterD20RollMode; rawFaces: number[] }
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
  /** Exact terminal evidence reconstructed before the parent publishes its aggregate state. */
  frozenTerminal?: Pick<
    Extract<SpatialMovementRuleEvaluation, { kind: 'TERMINAL' }>,
    'result' | 'selectionChecksum' | 'currentnessChecksum'
  > & { resumeRoot?: FrozenMovementReactionRemainder['root'] }
  resolution?: SpatialMovementRuleResolution
  resolutionCommand?: SpatialResolutionCommand
  /** Zero-based random integer below `maxExclusive`, for every die the server rolls. */
  random: (maxExclusive: number) => number
  /**
   * The voluntary mover chose to move carefully: a field that allows passage at half speed raises no
   * contact, so it asks for no save. Every call for one move supplies its saved command's choice.
   */
  carefully?: boolean
  beforeTerminalApply?: () => Promise<void>
  /** Stages, but does not apply, every spatial candidate through this contact. */
  interruptAfterPathDistance?: number
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
  if (input.frozenTerminal) {
    if (
      input.pendingSnapshot ||
      input.frozenReactionRemainder ||
      input.resolution ||
      input.resolutionCommand ||
      input.initialReactionTimeline ||
      input.interruptAfterPathDistance !== undefined
    )
      throw new EncounterValidationError(
        'Frozen terminal movement cannot include pending or reaction execution state.'
      )
    if (input.frozenTerminal.result.reactionExecutions.length !== 0)
      throw new EncounterValidationError('Frozen terminal movement cannot retain reactions.')
    if (input.frozenTerminal.resumeRoot) {
      const resumeRoot = input.frozenTerminal.resumeRoot
      if (
        resumeRoot.terminalPassageStop ||
        (input.occurrenceVersion ?? 0) !== resumeRoot.resolutionCommands.length + 1
      )
        throw new EncounterValidationError('Frozen terminal response history is inconsistent.')
      verifyFrozenReactionRoot({
        context: { root: resumeRoot },
        root,
        currentPosition: input.currentPosition,
        sceneVersion: input.sceneVersion
      })
    }
    verifyFrozenTerminalIdentity({ input, root })
  }
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
    appliedExecutions.find((execution) => execution.execution.movementInterruption?.kind === 'STOP')
      ?.candidate.candidate.pathDistance ?? null
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
  if (
    input.initialReactionTimeline &&
    (input.pendingSnapshot || input.frozenReactionRemainder || input.frozenTerminal)
  )
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
    !input.frozenTerminal?.resumeRoot &&
    root.expectedSceneVersion !== input.sceneVersion
  )
    throw new EncounterConflictError('The spatial movement Scene is stale.')
  const snapshotEffects = await input.spatialScope.snapshot()
  const candidates = frozenReactionRemainder
    ? frozenSpatialCandidates(frozenReactionRemainder, appliedExecutions.length)
    : collectSpatialMovementCandidates({
        actorIdByTokenId: input.actorIdByTokenId,
        effects: snapshotEffects.map(toSpatialInstance),
        movementKind: root.movementKind,
        path: root.originalPath,
        tokens: input.sceneTokens,
        movingTokenId: root.tokenId,
        carefully: input.carefully
      })
  const computedSelectionChecksum = checksumSpatialMovementSelection({
    encounterId: input.encounter.id,
    sceneId: input.sceneId,
    tokenId: root.tokenId,
    movementKind: root.movementKind,
    path: root.originalPath,
    candidates
  })
  const selectionChecksum =
    frozenReactionRemainder?.spatialSelectionChecksum ??
    input.frozenTerminal?.selectionChecksum ??
    computedSelectionChecksum
  if (
    frozenReactionRemainder &&
    frozenReactionRemainder.appliedSpatialPrefix === null &&
    computedSelectionChecksum !== selectionChecksum
  )
    throw new EncounterConflictError('The frozen spatial candidate selection is stale.')
  if (input.frozenTerminal && computedSelectionChecksum !== input.frozenTerminal.selectionChecksum)
    throw new EncounterConflictError('The frozen terminal candidate selection is stale.')
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
  if (
    (resumeContext || frozenReactionRemainder || input.frozenTerminal) &&
    input.encounter.automationMode === 'MANUAL'
  )
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
    if (input.frozenTerminal && input.frozenTerminal.currentnessChecksum !== currentnessChecksum)
      throw new EncounterConflictError('The frozen terminal currentness facts are stale.')
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
    if (!frozenReactionRemainder && !input.frozenTerminal)
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
    : collectSpatialMovementCandidates({
        actorIdByTokenId: input.actorIdByTokenId,
        effects: [...lockedEffects.values()].map(toSpatialInstance),
        movementKind: root.movementKind,
        path: root.originalPath,
        tokens: input.sceneTokens,
        movingTokenId: root.tokenId,
        carefully: input.carefully
      })
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
  if (input.frozenTerminal && input.frozenTerminal.currentnessChecksum !== currentnessChecksum)
    throw new EncounterConflictError('The frozen terminal currentness facts are stale.')
  const states = new Map(
    [...targets.entries()].map(([actorId, target]) => [actorId, copyState(target.state)])
  )
  const applications = new Map<string, CharacterRuleActionApplication[]>()
  const executions: SpatialExecution[] = []
  const completedPrefix = input.frozenTerminal
    ? input.frozenTerminal.result.status === 'BATCH_COMPLETE'
      ? input.frozenTerminal.result.executions
      : []
    : (resumeContext?.completedExecutions ??
      frozenReactionRemainder?.completedSpatialExecutions.slice(appliedExecutions.length) ??
      [])
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
    const effectInput = executionInput({
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
        effect,
        target,
        state,
        result: reconstructed
      })
      if (checksumRuleDocument(rebuilt) !== checksumRuleDocument(stored))
        throw new EncounterConflictError('The completed spatial execution cannot be reconstructed.')
      stageExecution({ execution: rebuilt, states, applications, executions })
      if (rebuilt.execution.movementInterruption?.kind === 'STOP') {
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
    } else if (input.frozenTerminal) {
      throw new EncounterConflictError('The frozen terminal spatial execution is stale.')
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
    // A spatial save belongs to the contacted actor, so its roller's preference applies.
    if ('continuation' in result && !d20 && input.autoRoll[candidate.targetActorId] === true) {
      const automatic = await resolveAutomatic({
        effectInput,
        paused: result,
        random: input.random
      })
      result = automatic.result
      d20 = automatic.d20
    }
    // Its damage dice belong to the zone source's controller, who may auto-roll them.
    while (
      'continuation' in result &&
      d20 &&
      isDamageDieRequest(result.continuation, result.evidencePolicy) &&
      input.autoRoll[spatialPendingRollerActorId({ candidate, diceStage: d20 })] === true
    )
      result = await resolveAutomaticDie({ effectInput, paused: result, d20, random: input.random })
    if ('continuation' in result) {
      requireSupportedD20Policy(result.evidencePolicy)
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
      effect,
      target,
      state,
      result
    })
    stageExecution({ execution: completed, states, applications, executions })
    if (completed.execution.movementInterruption?.kind === 'STOP') {
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

function verifyFrozenTerminalIdentity(input: {
  input: Parameters<typeof evaluateEncounterSpatialMovementRuleBatch>[0]
  root: SpatialMovementRuleRoot
}) {
  const terminal = input.input.frozenTerminal
  if (!terminal) throw new EncounterValidationError('Frozen terminal evidence is unavailable.')
  const result = terminal.result
  const expectedSceneVersion =
    input.input.sceneVersion +
    (intent(input.root.tokenId, input.input.currentPosition, result.terminalPosition) ? 1 : 0)
  if (
    result.occurrenceId !== input.input.occurrenceId ||
    result.occurrenceVersion !== (input.input.occurrenceVersion ?? 0) ||
    result.encounterId !== input.root.encounterId ||
    result.encounterVersion !== input.input.encounter.version + 1 ||
    result.sceneId !== input.root.sceneId ||
    result.sceneVersion !== expectedSceneVersion ||
    result.tokenId !== input.root.tokenId ||
    result.movementKind !== input.root.movementKind
  )
    throw new EncounterConflictError('The frozen terminal movement root is stale.')
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

function toSpatialInstance(effect: EncounterSpatialRuleEffectRecord) {
  return {
    effectId: effect.id,
    sourceActorId:
      effect.definition.origin.kind === 'ENCOUNTER' ? effect.definition.origin.sourceActorId : null,
    sourceTokenId: effect.placement.sourceTokenId,
    anchorKind: effect.placement.anchorKind,
    geometry: effect.placement.geometry,
    triggerModes: effect.placement.triggerModes,
    movementKinds: effect.placement.movementKinds,
    bypassAtHalfSpeed: isVisibleHalfSpeedField(effect)
  } as const
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

function executionInput(input: {
  effect: EncounterSpatialRuleEffectRecord
  target: LockedTarget
  state: TargetState
  occurrenceId: string
  runtime: RulesRuntimeService
}): TargetBoundActiveRuleEffectExecutionInput {
  if (input.effect.definition.frozenGraph.source.gameSystemId !== input.target.actor.systemId)
    throw new EncounterValidationError('The spatial effect and target Game Systems do not match.')
  return {
    activeEffectId: input.effect.id,
    activeEffectVersion: input.effect.version,
    definition: input.effect.definition,
    lifecycle: input.effect.lifecycle,
    lifecycleChecksum: input.effect.lifecycleChecksum,
    occurrenceId: input.occurrenceId,
    targetActorId: input.target.actor.id,
    currentHitPoints: input.state.current,
    temporaryHitPoints: input.state.temporary,
    maximumHitPoints: input.target.maximumHitPoints,
    targetScalarValues: input.target.scalarValues,
    targetConditionIds: input.state.conditions,
    targetDerivedFacts: input.target.targetDerivedFacts,
    defenses: input.target.defenses,
    conditionImmunityIds: input.target.conditionImmunityIds,
    runtime: input.runtime,
    adapters: characterRuleActionSystemAdapterRegistry
  }
}

function pendingCandidate(input: {
  ordinal: number
  candidate: SpatialMovementCandidate
  effect: EncounterSpatialRuleEffectRecord
  target: LockedTarget
  state: TargetState
  d20Policy: TargetBoundActiveRuleEffectExecutionPaused['evidencePolicy']
  diceStage: SpatialD20Roll | null
}) {
  const targetStateChecksum = checksumRuleDocument({
    targetActorId: input.target.actor.id,
    currentHitPoints: input.state.current,
    temporaryHitPoints: input.state.temporary,
    maximumHitPoints: input.target.maximumHitPoints,
    conditionIds: input.state.conditions,
    scalarValues: input.target.scalarValues
  })
  return {
    ordinal: input.ordinal,
    candidate: input.candidate,
    effect: {
      effectId: input.effect.id,
      version: input.effect.version,
      definitionChecksum: input.effect.definitionChecksum,
      lifecycleChecksum: input.effect.lifecycleChecksum,
      placementChecksum: input.effect.placementChecksum,
      spatialStateChecksum: input.effect.spatialStateChecksum,
      authoredEffectId: input.effect.definition.authoredEffectId,
      compiledEntryId: input.effect.definition.compiledEntryId,
      frozenGraphNodeId: input.effect.definition.frozenGraphNodeId,
      frozenSourceChecksum: input.effect.definition.frozenGraph.source.checksum,
      capabilityContractVersion: input.effect.definition.frozenGraph.capabilityContractVersion,
      activation: input.effect.placement.activation,
      revealed: input.effect.spatialState.revealed,
      revealOnTrigger: input.effect.placement.revealOnTrigger
    },
    target: input.target.character
      ? {
          kind: 'CHARACTER' as const,
          characterId: input.target.character.id,
          streamVersion: input.target.character.streamVersion,
          projectionChecksum: input.target.character.projectionChecksum,
          mechanicalContextChecksum: input.target.character.mechanicalContextChecksum,
          targetStateChecksum
        }
      : { kind: 'ENCOUNTER_ACTOR' as const, targetStateChecksum },
    d20Policy: input.d20Policy,
    diceStage: input.diceStage
  }
}

function completeExecution(input: {
  ordinal: number
  pending: ReturnType<typeof pendingCandidate>
  effect: EncounterSpatialRuleEffectRecord
  target: LockedTarget
  state: TargetState
  result: TargetBoundActiveRuleEffectExecutionResult
}): SpatialExecution {
  const folded = foldCharacterMechanicsApplications({
    targetActorId: input.target.actor.id,
    currentHitPoints: input.state.current,
    temporaryHitPoints: input.state.temporary,
    maximumHitPoints: input.target.maximumHitPoints,
    deathSaves: input.state.deathSaves,
    conditionIds: input.state.conditions,
    scalarValues: input.target.scalarValues,
    applications: input.result.applications
  })
  return {
    ordinal: input.ordinal,
    candidate: input.pending,
    execution: input.result.execution,
    d20: input.result.d20,
    targetTransition: {
      checksum: input.pending.target.targetStateChecksum,
      before: folded.before,
      after: folded.after
    },
    applications: folded.applications
  }
}

function stageExecution(input: {
  execution: SpatialExecution
  states: Map<string, TargetState>
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

async function resolveAutomatic(input: {
  effectInput: TargetBoundActiveRuleEffectExecutionInput
  paused: TargetBoundActiveRuleEffectExecutionPaused
  random: (maxExclusive: number) => number
}) {
  const paused = input.paused
  if (!paused.evidencePolicy)
    throw new EncounterConflictError('Automatic spatial execution requested unsupported evidence.')
  const requestId = paused.continuation.request.requestId
  const { faces, rollMode } = resolveEncounterD20Answer({
    derivedRollMode: paused.evidencePolicy.rollMode,
    answer: { kind: 'AUTO_ROLL', requestId },
    rollD20: () => input.random(20) + 1
  })
  return {
    d20: { rollMode, rawFaces: faces },
    result: await resumeTargetBoundActiveRuleEffectWithPause({
      ...input.effectInput,
      continuation: paused.continuation,
      resolution: { requestId, rawFaces: faces, rollMode },
      expectedEvidencePolicy: paused.evidencePolicy
    })
  }
}

function resolveAutomaticDie(input: {
  effectInput: TargetBoundActiveRuleEffectExecutionInput
  paused: TargetBoundActiveRuleEffectExecutionPaused
  d20: SpatialD20Roll
  random: (maxExclusive: number) => number
}) {
  const { request } = input.paused.continuation
  if (request.kind !== 'INTEGER_RANGE')
    throw new EncounterConflictError('Automatic spatial execution requested unsupported evidence.')
  const value = resolveEncounterIntegerAnswer({
    min: request.min,
    max: request.max,
    answer: { kind: 'AUTO_ROLL', requestId: request.requestId },
    random: input.random
  })
  return resumeTargetBoundActiveRuleEffectWithPause({
    ...input.effectInput,
    continuation: input.paused.continuation,
    resolution: { requestId: request.requestId, value, d20: input.d20 },
    expectedEvidencePolicy: input.paused.evidencePolicy
  })
}

function requireSupportedD20Policy(
  policy: TargetBoundActiveRuleEffectExecutionPaused['evidencePolicy']
): NonNullable<TargetBoundActiveRuleEffectExecutionPaused['evidencePolicy']> {
  if (!policy) throw new EncounterConflictError('Spatial execution requested unsupported evidence.')
  return policy
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
  d20: SpatialD20Roll
}> {
  const resolution = input.resolution
  const policy = requireSupportedD20Policy(input.pending.d20Policy)
  const request = input.pendingSnapshot.request
  const {
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    applicationContext: _applicationContext,
    snapshotKind: _snapshotKind,
    ...continuation
  } = input.pendingSnapshot
  if (request.requestId !== resolution.requestId || request.kind !== 'INTEGER_RANGE')
    throw new EncounterConflictError('The spatial evidence request is stale.')
  if (isDamageDieRequest(continuation, policy)) {
    const d20 = input.pending.diceStage
    if (!d20) throw new EncounterConflictError('The spatial evidence request is stale.')
    const value = resolveEncounterIntegerAnswer({
      min: request.min,
      max: request.max,
      answer: resolution,
      random: input.random
    })
    return {
      d20: { rollMode: d20.rollMode, rawFaces: [...d20.rawFaces] },
      result: await resumeTargetBoundActiveRuleEffectWithPause({
        ...input.effectInput,
        continuation,
        resolution: { requestId: resolution.requestId, value, d20 },
        expectedEvidencePolicy: policy
      })
    }
  }
  if (
    input.pending.diceStage ||
    request.min !== 1 ||
    request.max !== 20 ||
    request.nodeId !== policy.requestNodeId
  )
    throw new EncounterConflictError('The spatial evidence request is stale.')
  const { faces, rollMode } = resolveEncounterD20Answer({
    derivedRollMode: policy.rollMode,
    answer: resolution,
    rollD20: () => input.random(20) + 1
  })
  return {
    d20: { rollMode, rawFaces: faces },
    result: await resumeTargetBoundActiveRuleEffectWithPause({
      ...input.effectInput,
      continuation,
      resolution: { requestId: resolution.requestId, rawFaces: faces, rollMode },
      expectedEvidencePolicy: policy
    })
  }
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

function copyState(state: TargetState): TargetState {
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
