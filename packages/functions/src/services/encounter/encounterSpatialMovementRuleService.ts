import { randomInt } from 'node:crypto'

import {
  createEncounterRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord,
  type EncounterSpatialRuleEffectRecord,
  type LockedSpatialRuleEffectScope
} from '@artificer-toolkit/db'
import type {
  ServerKernelRuleExecutionPendingSnapshotDto,
  StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  movementRuleResolutionCommandDtoSchema,
  spatialResolutionCommandDtoSchema,
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  storedRuleExecutionResultDtoSchema
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { SpatialSceneToken } from '@artificer-toolkit/shared/vtt'
import {
  collectSpatialMovementCandidates,
  type ScenePoint,
  type SpatialMovementCandidate,
  type SpatialMovementKind
} from '@artificer-toolkit/shared/vtt'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { z } from 'zod'

import { characterRuleActionSystemAdapterRegistry } from '../rules/characterRuleActionSystemAdapterRegistry.js'
import type { CharacterRuleActionApplication } from '../rules/characterRuleActionSystemAdapter.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  reconstructTargetBoundActiveRuleEffectCompletion,
  resumeTargetBoundActiveRuleEffectWithPause,
  type TargetBoundActiveRuleEffectExecutionPaused,
  type TargetBoundActiveRuleEffectExecutionInput,
  type TargetBoundActiveRuleEffectExecutionResult
} from '../rules/targetBoundActiveRuleEffectExecutor.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  applyLockedEncounterActorMechanicsBatch,
  applyLockedEncounterCharacterMechanicsBatch,
  deriveEncounterCharacterMechanicsEventCommandId,
  foldCharacterMechanicsApplications,
  readEncounterActorConditionState
} from './encounterCharacterMechanicsBatch.js'
import { requireEncounterActorRuleResult } from './encounterActorRuleEvaluation.js'
import { snapshotStatBlock } from './encounterProjection.js'
import {
  lockEncounterActiveEffectTargets,
  type LockedEncounterActiveEffectCharacter,
  type LockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'

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
const rawResolutionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    requestId: z.string().min(1).max(256),
    kind: z.literal('ENTER_DICE'),
    rawFaces: z.array(z.number().int().min(1).max(20)).min(1).max(2)
  }),
  z.strictObject({
    requestId: z.string().min(1).max(256),
    kind: z.literal('SYSTEM_ROLL')
  })
])

type TargetState = { current: number; temporary: number; conditions: string[] }
type LockedTarget = {
  actor: EncounterActorRecord
  character: LockedEncounterActiveEffectCharacter | null
  state: TargetState
  initialConditionRows: unknown[] | null
  targetDerivedFacts: Readonly<Record<string, unknown>>
  defenses: TargetBoundActiveRuleEffectExecutionInput['defenses']
  conditionImmunityIds: readonly string[]
  scalarValues: Readonly<Record<string, number>>
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

export type SpatialMovementRuleResolution = z.infer<typeof rawResolutionSchema>
type SpatialResolutionCommand = z.infer<typeof spatialResolutionCommandDtoSchema>
type MovementRuleResolutionCommand = z.infer<typeof movementRuleResolutionCommandDtoSchema>
type MovementReactionPendingContext = Extract<
  ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
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
  trx: DBLike
  actorUserId: string
  encounter: EncounterRecord
  sceneId: string
  sceneVersion: number
  actorIdByTokenId: ReadonlyMap<string, string>
  sceneTokens: readonly SpatialSceneToken[]
  spatialScope: LockedSpatialRuleEffectScope
  root: SpatialMovementRuleRoot
  currentPosition: ScenePoint
  occurrenceId: string
  executionCommandId: string
  occurrenceVersion?: number
  runtime?: RulesRuntimeService
  attunementSlotOverride: number | null
  getEncounterActorSnapshot?: () => Promise<{
    rules: EncounterActorRuleOutput
    encounter: EncounterRecord
  }>
  /** Caller-held Character locks acquired before any active/spatial effect row. */
  lockedTargets?: LockedEncounterActiveEffectTargets
  pendingSnapshot?: ServerKernelRuleExecutionPendingSnapshotDto
  /** Exact server-sealed movement remainder after a reaction choice settles. */
  frozenReactionRemainder?: FrozenMovementReactionRemainder
  resolution?: SpatialMovementRuleResolution
  resolutionCommand?: SpatialResolutionCommand
  rollD20?: () => number
  beforeTerminalApply?: () => Promise<void>
  /** Stages, but does not apply, every spatial candidate through this contact. */
  interruptAfterPathDistance?: number
}): Promise<SpatialMovementRuleEvaluation> {
  const root = normalizeRoot(input.root)
  const interruptAfterPathDistance = normalizeInterruptDistance(
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
  const candidates = frozenReactionRemainder
    ? frozenSpatialCandidates(frozenReactionRemainder)
    : collectSpatialMovementCandidates({
        actorIdByTokenId: input.actorIdByTokenId,
        effects: snapshotEffects.map(toSpatialInstance),
        movementKind: root.movementKind,
        path: root.originalPath,
        tokens: input.sceneTokens,
        movingTokenId: root.tokenId
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
    frozenReactionRemainder?.spatialSelectionChecksum ?? computedSelectionChecksum
  if (
    frozenReactionRemainder &&
    frozenReactionRemainder.appliedSpatialPrefix === null &&
    computedSelectionChecksum !== selectionChecksum
  )
    throw new EncounterConflictError('The frozen spatial candidate selection is stale.')
  const terminalIntent = intent(root.tokenId, input.currentPosition, root.originalPath.at(-1)!)
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
    if (interruptAfterPathDistance !== null) {
      const boundaryPosition = pathPointAtDistance(root.originalPath, interruptAfterPathDistance)!
      return {
        kind: 'REACTION_BOUNDARY',
        boundaryDistance: interruptAfterPathDistance,
        boundaryPosition,
        movementIntent: intent(root.tokenId, input.currentPosition, boundaryPosition),
        completedExecutions: [],
        appliedPrefix: null,
        completedReactionExecutions: frozenReactionRemainder?.completedReactionExecutions ?? [],
        remainingCandidates: [],
        resolutionCommands,
        selectionChecksum,
        currentnessChecksum
      }
    }
    if (!frozenReactionRemainder) return { kind: 'NO_CANDIDATES', movementIntent: terminalIntent }
    const result = completeMovementWithoutSpatial({ input, root })
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
  const locked =
    input.lockedTargets ??
    (await lockEncounterActiveEffectTargets({
      trx: input.trx,
      encounter: input.encounter,
      actors: candidateActors,
      attunementSlotOverride: input.attunementSlotOverride,
      getEncounterActorSnapshot: input.getEncounterActorSnapshot
    }))
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
        movingTokenId: root.tokenId
      })
  if (JSON.stringify(lockedCandidates) !== JSON.stringify(candidates))
    throw new EncounterConflictError('Spatial candidates changed after target locking.')
  const targets = createTargets({ candidates, actorById, locked })
  // This is deliberately derived only after every spatial root and target
  // currentness fact is locked.  The public Scene command must never rebuild
  // receipt currentness from its submitted path or an unlocked projection.
  const currentnessChecksum = checksumSpatialCurrentness({
    encounter: input.encounter,
    candidates: candidates.map((candidate, ordinal) => {
      const effect = lockedEffects.get(candidate.effectId)!
      const target = targets.get(candidate.targetActorId)!
      return pendingCandidate({
        ordinal,
        candidate,
        effect,
        target,
        state: target.state,
        d20Policy: null
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
    (frozenReactionRemainder?.appliedSpatialPrefix === null
      ? frozenReactionRemainder?.completedSpatialExecutions
      : []) ??
    []
  const pendingSpatialCandidate =
    resumeContext?.currentCandidate ?? frozenReactionRemainder?.currentSpatialCandidate ?? null
  let stopAtDistance: number | null = null

  for (const [ordinal, candidate] of candidates.entries()) {
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
    const currentCandidate = pendingCandidate({
      ordinal,
      candidate,
      effect,
      target,
      state,
      d20Policy:
        completedPrefix[ordinal]?.candidate.d20Policy ??
        (pendingSpatialCandidate && ordinal === pendingSpatialCandidate.ordinal
          ? pendingSpatialCandidate.d20Policy
          : null)
    })
    const effectInput = executionInput({
      effect,
      target,
      state,
      occurrenceId: input.occurrenceId,
      runtime: input.runtime
    })
    const stored = completedPrefix[ordinal]
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
        frozenReactionRemainder.remainingSpatialCandidates[ordinal - completedPrefix.length]
      if (!expected || !sameRemainingPendingCandidate(currentCandidate, expected))
        throw new EncounterConflictError('The frozen spatial contact suffix is stale.')
    }
    let result =
      pendingSpatialCandidate && ordinal === pendingSpatialCandidate.ordinal
        ? await resumeSpatial({
            effectInput,
            pendingSnapshot: input.pendingSnapshot!,
            pending: pendingSpatialCandidate,
            resolution: input.resolution!,
            rollD20: input.rollD20
          })
        : await executeTargetBoundActiveRuleEffectWithPause(effectInput)
    if ('continuation' in result && input.encounter.automationMode === 'AUTOMATIC') {
      const automatic = await resolveAutomatic({
        effectInput,
        paused: result,
        rollD20: input.rollD20
      })
      if ('continuation' in automatic)
        throw new EncounterConflictError('A spatial candidate may request only one evidence stage.')
      result = automatic
    }
    if (
      'continuation' in result &&
      pendingSpatialCandidate &&
      ordinal === pendingSpatialCandidate.ordinal
    )
      throw new EncounterConflictError('A spatial candidate may request only one evidence stage.')
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
        d20Policy: result.evidencePolicy
      })
      const pendingRemaining = candidates.slice(ordinal + 1).map((remaining, offset) => {
        const remainingEffect = lockedEffects.get(remaining.effectId)!
        const remainingTarget = targets.get(remaining.targetActorId)!
        return pendingCandidate({
          ordinal: ordinal + offset + 1,
          candidate: remaining,
          effect: remainingEffect,
          target: remainingTarget,
          state: states.get(remaining.targetActorId)!,
          d20Policy: null
        })
      })
      const currentSceneVersion =
        input.sceneVersion + (intent(root.tokenId, input.currentPosition, contactPosition) ? 1 : 0)
      const nextPendingSnapshot =
        frozenReactionRemainder && frozenReactionRemainder.reactionTimeline.length > 0
          ? movementReactionSpatialPendingSnapshot({
              paused: result,
              reactionRemainder: frozenReactionRemainder,
              root,
              completedExecutions: executions,
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
  }

  if (interruptAfterPathDistance !== null) {
    const boundaryPosition = pathPointAtDistance(root.originalPath, interruptAfterPathDistance)!
    const nextOrdinal = executions.length
    return {
      kind: 'REACTION_BOUNDARY',
      boundaryDistance: interruptAfterPathDistance,
      boundaryPosition,
      movementIntent: intent(root.tokenId, input.currentPosition, boundaryPosition),
      completedExecutions: executions,
      // A reaction boundary seals the completed spatial prefix into the same
      // occurrence.  It must not mutate Characters, spatial roots, or
      // projections before every reaction/evidence pause is terminal.
      appliedPrefix: null,
      completedReactionExecutions: frozenReactionRemainder?.completedReactionExecutions ?? [],
      remainingCandidates: candidates.slice(nextOrdinal).map((remaining, offset) => {
        const remainingEffect = lockedEffects.get(remaining.effectId)!
        const remainingTarget = targets.get(remaining.targetActorId)!
        return pendingCandidate({
          ordinal: nextOrdinal + offset,
          candidate: remaining,
          effect: remainingEffect,
          target: remainingTarget,
          state: states.get(remaining.targetActorId)!,
          d20Policy: null
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
  const result = await applyTerminal({
    input,
    root,
    effects: lockedEffects,
    targets,
    applications,
    executions,
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
  context: FrozenMovementReactionRemainder
): SpatialMovementCandidate[] {
  if (context.appliedSpatialPrefix !== null) {
    return [
      ...(context.currentSpatialCandidate ? [context.currentSpatialCandidate.candidate] : []),
      ...context.remainingSpatialCandidates.map((candidate) => candidate.candidate)
    ]
  }
  return [
    ...context.completedSpatialExecutions.map((execution) => execution.candidate.candidate),
    ...(context.currentSpatialCandidate ? [context.currentSpatialCandidate.candidate] : []),
    ...context.remainingSpatialCandidates.map((candidate) => candidate.candidate)
  ]
}

export function checksumSpatialMovementSelection(input: {
  encounterId: string
  sceneId: string
  tokenId: string
  movementKind: SpatialMovementKind
  path: readonly ScenePoint[]
  candidates: readonly unknown[]
}): string {
  return checksumRuleDocument(input)
}

export function checksumSpatialCurrentness(input: {
  encounter: Pick<EncounterRecord, 'id' | 'version'>
  candidates: readonly unknown[]
}): string {
  return checksumRuleDocument({
    schemaVersion: 1,
    encounter: { id: input.encounter.id, version: input.encounter.version },
    candidates: input.candidates
  })
}

function verifyFrozenReactionRoot(input: {
  context: FrozenMovementReactionRemainder
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
    JSON.stringify(context.root.originalPath) !== JSON.stringify(input.root.originalPath) ||
    JSON.stringify(context.root.terminalPassageStop ?? null) !==
      JSON.stringify(input.root.terminalPassageStop ?? null) ||
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

function toSpatialInstance(effect: EncounterSpatialRuleEffectRecord) {
  return {
    effectId: effect.id,
    sourceActorId:
      effect.definition.origin.kind === 'ENCOUNTER' ? effect.definition.origin.sourceActorId : null,
    sourceTokenId: effect.placement.sourceTokenId,
    anchorKind: effect.placement.anchorKind,
    geometry: effect.placement.geometry,
    triggerModes: effect.placement.triggerModes,
    movementKinds: effect.placement.movementKinds
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

function createTargets(input: {
  candidates: readonly SpatialMovementCandidate[]
  actorById: ReadonlyMap<string, EncounterActorRecord>
  locked: Awaited<ReturnType<typeof lockEncounterActiveEffectTargets>>
}): Map<string, LockedTarget> {
  const targets = new Map<string, LockedTarget>()
  for (const candidate of input.candidates) {
    if (targets.has(candidate.targetActorId)) continue
    const actor = input.actorById.get(candidate.targetActorId)!
    if (actor.kind === 'CHARACTER') {
      const character = input.locked.lockedCharacters.get(actor.sourceId!)
      if (!character) throw new EncounterConflictError('The spatial Character target is stale.')
      targets.set(actor.id, {
        actor,
        character,
        state: {
          current: character.mechanics.commandState.state.hitpoints.current,
          temporary: character.mechanics.commandState.state.hitpoints.temp ?? 0,
          conditions: (character.mechanics.commandState.state.conditions ?? []).map(
            (condition) => condition.conditionTypeId
          )
        },
        initialConditionRows: null,
        targetDerivedFacts: {
          ...character.overlay.rulePolicyOutput,
          targetProtection: {
            status: 'NORMALIZED' as const,
            defenses: character.overlay.rulePolicyOutput.defenses,
            conditionImmunityIds: character.overlay.rulePolicyOutput.conditionImmunityIds
          }
        },
        defenses: character.overlay.rulePolicyOutput.defenses,
        conditionImmunityIds: character.overlay.rulePolicyOutput.conditionImmunityIds,
        scalarValues: input.locked.effectiveScalarValuesByActorId?.get(actor.id) ?? {}
      })
    } else {
      const reconciled = input.locked.encounterActors.get(actor.id)
      const conditions = readEncounterActorConditionState(reconciled?.conditions ?? [])
      const actorRule = requireEncounterActorRuleResult(input.locked.encounterActorRules!, actor.id)
      if (actorRule.targetProtection.status !== 'NORMALIZED')
        throw new EncounterValidationError(
          'Encounter actor spatial protections are not normalized.'
        )
      targets.set(actor.id, {
        actor: reconciled ?? actor,
        character: null,
        state: {
          current: (reconciled ?? actor).currentHitPoints,
          temporary: (reconciled ?? actor).tempHitPoints,
          conditions: conditions.ids
        },
        initialConditionRows: conditions.values,
        targetDerivedFacts: {
          targetProtection: actorRule.targetProtection,
          statBlock: snapshotStatBlock(reconciled ?? actor)
        },
        defenses: actorRule.targetProtection.defenses,
        conditionImmunityIds: actorRule.targetProtection.conditionImmunityIds,
        scalarValues: input.locked.effectiveScalarValuesByActorId?.get(actor.id) ?? {}
      })
    }
  }
  return targets
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
    maximumHitPoints: input.target.character?.maximumHitPoints ?? input.target.actor.maxHitPoints,
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
}) {
  const targetStateChecksum = checksumRuleDocument({
    targetActorId: input.target.actor.id,
    currentHitPoints: input.state.current,
    temporaryHitPoints: input.state.temporary,
    maximumHitPoints: input.target.character?.maximumHitPoints ?? input.target.actor.maxHitPoints,
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
          projectionChecksum: input.target.character.overlay.projectionChecksum,
          mechanicalContextChecksum: input.target.character.overlay.mechanicalContextChecksum,
          targetStateChecksum
        }
      : { kind: 'ENCOUNTER_ACTOR' as const, targetStateChecksum },
    d20Policy: input.d20Policy
  }
}

function transition(effect: EncounterSpatialRuleEffectRecord) {
  const base = {
    expectedVersion: effect.version,
    definitionChecksum: effect.definitionChecksum,
    lifecycleChecksum: effect.lifecycleChecksum,
    placementChecksum: effect.placementChecksum
  }
  if (effect.placement.activation === 'ONE_SHOT')
    return {
      kind: 'DELETE' as const,
      ...base,
      spatialStateChecksum: effect.spatialStateChecksum
    }
  if (!effect.spatialState.revealed && effect.placement.revealOnTrigger)
    return {
      kind: 'UPDATE' as const,
      ...base,
      afterVersion: effect.version + 1,
      beforeSpatialStateChecksum: effect.spatialStateChecksum,
      afterSpatialStateChecksum: checksumRuleDocument({
        schemaVersion: 1,
        revealed: true
      }),
      beforeRevealed: false as const,
      afterRevealed: true as const
    }
  return {
    kind: 'UNCHANGED' as const,
    ...base,
    spatialStateChecksum: effect.spatialStateChecksum
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
    maximumHitPoints: input.target.character?.maximumHitPoints ?? input.target.actor.maxHitPoints,
    conditionIds: input.state.conditions,
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
    conditions: [...input.execution.targetTransition.after.conditionIds]
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
  rollD20?: () => number
}) {
  const paused = input.paused
  if (!paused.evidencePolicy)
    throw new EncounterConflictError('Automatic spatial execution requested unsupported evidence.')
  const roll = input.rollD20 ?? (() => randomInt(1, 21))
  return resumeTargetBoundActiveRuleEffectWithPause({
    ...input.effectInput,
    continuation: paused.continuation,
    resolution: {
      requestId: paused.continuation.request.requestId,
      rawFaces: Array.from({ length: paused.evidencePolicy.rollMode === 'NORMAL' ? 1 : 2 }, () =>
        roll()
      )
    },
    expectedEvidencePolicy: paused.evidencePolicy
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
  const command = spatialResolutionCommandDtoSchema.parse(input.command)
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
  rollD20?: () => number
}) {
  const resolution = rawResolutionSchema.parse(input.resolution)
  const policy = requireSupportedD20Policy(input.pending.d20Policy)
  const continuationRequest = input.pendingSnapshot.request
  if (
    continuationRequest.requestId !== resolution.requestId ||
    continuationRequest.kind !== 'INTEGER_RANGE' ||
    continuationRequest.min !== 1 ||
    continuationRequest.max !== 20 ||
    continuationRequest.nodeId !== policy.requestNodeId
  )
    throw new EncounterConflictError('The spatial evidence request is stale.')
  const count = policy.rollMode === 'NORMAL' ? 1 : 2
  if (resolution.kind === 'ENTER_DICE' && resolution.rawFaces.length !== count)
    throw new EncounterConflictError('The spatial evidence face count is invalid.')
  const rawFaces =
    resolution.kind === 'SYSTEM_ROLL'
      ? Array.from({ length: count }, () => (input.rollD20 ?? (() => randomInt(1, 21)))())
      : resolution.rawFaces
  const {
    applicationContext: _applicationContext,
    snapshotKind: _snapshotKind,
    ...continuation
  } = input.pendingSnapshot
  return resumeTargetBoundActiveRuleEffectWithPause({
    ...input.effectInput,
    continuation,
    resolution: { requestId: resolution.requestId, rawFaces },
    expectedEvidencePolicy: policy
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
  reactionRemainder: FrozenMovementReactionRemainder
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
    JSON.stringify(context.root.originalPath) !== JSON.stringify(input.root.originalPath) ||
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
      JSON.stringify(candidate.contact) !== JSON.stringify(pending.candidate.contact) ||
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

async function applyTerminal(input: {
  input: Parameters<typeof evaluateEncounterSpatialMovementRuleBatch>[0]
  root: SpatialMovementRuleRoot
  effects: ReadonlyMap<string, EncounterSpatialRuleEffectRecord>
  targets: ReadonlyMap<string, LockedTarget>
  applications: ReadonlyMap<string, readonly CharacterRuleActionApplication[]>
  executions: readonly SpatialExecution[]
  terminalPosition?: ScenePoint
}): Promise<SpatialBatch> {
  const terminalIntent = intent(
    input.root.tokenId,
    input.input.currentPosition,
    input.terminalPosition ?? input.root.originalPath.at(-1)!
  )
  const characterTransitions: SpatialBatch['characterTransitions'] = []
  const encounterActorTransitions: SpatialBatch['encounterActorTransitions'] = []
  const encounterRepository = createEncounterRepository(input.input.trx)
  const changedTargets = [...input.targets].filter(([actorId]) => {
    const batch = input.applications.get(actorId)
    if (!batch?.length) return false
    const first = input.executions.find(
      (execution) => execution.candidate.candidate.targetActorId === actorId
    )!
    const last = [...input.executions]
      .reverse()
      .find((execution) => execution.candidate.candidate.targetActorId === actorId)!
    return (
      JSON.stringify(first.targetTransition.before) !== JSON.stringify(last.targetTransition.after)
    )
  })
  const changedCharacterTargets = changedTargets
    .filter(([, target]) => target.character)
    .sort(([, left], [, right]) => left.character!.id.localeCompare(right.character!.id))
  for (const [targetOrdinal, [actorId, target]] of changedCharacterTargets.entries()) {
    const batch = input.applications.get(actorId)!
    {
      const character = target.character
      if (!character) throw new EncounterConflictError('The spatial Character target is stale.')
      const applied = await applyLockedEncounterCharacterMechanicsBatch({
        trx: input.input.trx,
        actorUserId: input.input.actorUserId,
        encounterId: input.input.encounter.id,
        occurrenceId: input.input.occurrenceId,
        commandId: deriveEncounterCharacterMechanicsEventCommandId({
          occurrenceId: input.input.occurrenceId,
          sourceCommandId: input.input.executionCommandId,
          phase: 'SPATIAL_EFFECT',
          ordinal: targetOrdinal,
          targetCharacterId: character.id
        }),
        sourceCommandId: input.input.executionCommandId,
        targetActor: target.actor,
        targetCharacterId: character.id,
        mechanics: character.mechanics,
        overlay: character.overlay,
        effectiveMaximumHitPoints: character.maximumHitPoints,
        conditionDefinitions: character.conditionDefinitions,
        applications: batch,
        forceVersionAdvance: true
      })
      if (applied.streamVersion === null)
        throw new EncounterConflictError('Spatial Character state must advance once.')
      await encounterRepository.updateActor(applied.updatedActor)
      characterTransitions.push({
        characterId: character.id,
        targetActorId: target.actor.id,
        beforeStreamVersion: character.streamVersion,
        afterStreamVersion: applied.streamVersion,
        before: input.executions.find(
          (execution) => execution.candidate.candidate.targetActorId === actorId
        )!.targetTransition.before,
        after: applied.finalState
      })
    }
  }
  for (const [actorId, target] of changedTargets
    .filter(([, target]) => !target.character)
    .sort(([left], [right]) => left.localeCompare(right))) {
    const batch = input.applications.get(actorId)!
    {
      const applied = await applyLockedEncounterActorMechanicsBatch({
        trx: input.input.trx,
        targetActor: target.actor,
        initialConditionRows: target.initialConditionRows!,
        applications: batch
      })
      encounterActorTransitions.push({
        targetActorId: actorId,
        before: applied.targetTransition.before,
        after: applied.targetTransition.after
      })
    }
  }
  const spatialEffectTransitions: SpatialBatch['spatialEffectTransitions'] = []
  for (const effectId of [
    ...new Set(input.executions.map((execution) => execution.candidate.candidate.effectId))
  ].sort()) {
    const effect = input.effects.get(effectId)!
    const effectTransition = transition(effect)
    if (effectTransition.kind === 'DELETE')
      await input.input.spatialScope.deleteCas({
        id: effect.id,
        expectedVersion: effect.version
      })
    if (effectTransition.kind === 'UPDATE')
      await input.input.spatialScope.updateCurrentStateCas({
        id: effect.id,
        expectedVersion: effect.version,
        lifecycle: effect.lifecycle,
        spatialState: { schemaVersion: 1, revealed: true }
      })
    spatialEffectTransitions.push({ effectId, transition: effectTransition })
  }
  return storedRuleExecutionResultDtoSchema.parse({
    status: 'BATCH_COMPLETE',
    batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
    schemaVersion: 1,
    occurrenceId: input.input.occurrenceId,
    occurrenceVersion: input.input.occurrenceVersion ?? 0,
    encounterId: input.input.encounter.id,
    // This is a same-transaction proposal. The caller advances exactly these
    // aggregate roots before it appends the terminal occurrence receipt.
    encounterVersion: input.input.encounter.version + 1,
    sceneId: input.input.sceneId,
    sceneVersion: input.input.sceneVersion + (terminalIntent ? 1 : 0),
    tokenId: input.root.tokenId,
    movementKind: input.root.movementKind,
    reactionExecutions: input.input.frozenReactionRemainder?.completedReactionExecutions ?? [],
    terminalPosition: input.terminalPosition ?? input.root.originalPath.at(-1)!,
    executions: input.executions,
    spatialEffectTransitions,
    characterTransitions,
    encounterActorTransitions
  }) as SpatialBatch
}

function copyState(state: TargetState): TargetState {
  return {
    current: state.current,
    temporary: state.temporary,
    conditions: [...state.conditions]
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
  return JSON.stringify(left) === JSON.stringify(right)
}

function sameRemainingPendingCandidate(
  left: ReturnType<typeof pendingCandidate>,
  right: PendingContext['remainingCandidates'][number]
): boolean {
  const { targetStateChecksum: _leftChecksum, ...leftTarget } = left.target
  const { targetStateChecksum: _rightChecksum, ...rightTarget } = right.target
  return (
    JSON.stringify({ ...left, target: leftTarget }) ===
    JSON.stringify({ ...right, target: rightTarget })
  )
}
