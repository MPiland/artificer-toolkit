import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type {
  EncounterCastReactionOfferDto,
  EncounterFailedCounterDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  PendingNativeActionGraphs,
  ResumedNativeActionGraphs
} from './encounterActionExecution.js'

/** The kernel request a sealed snapshot waits on, without the application's wrapping. */
export function pendingSnapshotContinuation(
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
): ServerRuleExecutionContinuationDto {
  const {
    snapshotKind: _snapshotKind,
    applicationContext: _applicationContext,
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    phaseReceipts: _phaseReceipts,
    deferredCleaving: _deferredCleaving,
    ...continuation
  } = snapshot
  return continuation
}

/** The paused request a sealed snapshot holds, restored so its roller's answer can resume it. */
export function restoreEncounterActionPending(
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
): ResumedNativeActionGraphs {
  const { applicationContext: context, phaseReceipts } = snapshot
  if (context.kind !== 'ENCOUNTER_ACTION')
    throw new Error('The pending action snapshot is invalid.')
  return {
    kind: 'PENDING',
    continuation: pendingSnapshotContinuation(snapshot),
    d20Policy: context.d20Policy,
    twoPhase: context.twoPhase,
    ...(context.d20Belief ? { d20Belief: context.d20Belief } : {}),
    ...(context.heldD20 ? { heldD20: context.heldD20 } : {}),
    ...(context.legendaryResistance ? { legendaryResistance: context.legendaryResistance } : {}),
    ...(context.reactionChoice ? { reactionChoice: context.reactionChoice } : {}),
    ...(context.onHitChoice ? { onHitChoice: context.onHitChoice } : {}),
    ...(context.forcedMovementDestination
      ? { forcedMovementDestination: context.forcedMovementDestination }
      : {}),
    ...(phaseReceipts ? { phaseReceipts } : {})
  }
}

/**
 * The sealed pending snapshot of one paused action request: the kernel continuation with the
 * application context that lets its roller's answer resume it.
 */
export function buildEncounterActionPendingSnapshot(input: {
  execution: PendingNativeActionGraphs
  optionalCombatSnapshotChecksum: string | null | undefined
  commandJson: string
  commandFingerprint: string
  initiatorUserId: string
  sourceActorId: string
  targetActorId: string
  currentnessChecksum: string
  failedCounters?: readonly EncounterFailedCounterDto[]
}): ServerKernelRuleExecutionPendingSnapshotDto {
  const { execution } = input
  return {
    ...execution.continuation,
    snapshotKind: 'KERNEL_EVIDENCE',
    optionalCombatSnapshotChecksum: input.optionalCombatSnapshotChecksum,
    applicationContext: {
      kind: 'ENCOUNTER_ACTION',
      schemaVersion: 1,
      commandJson: input.commandJson,
      commandFingerprint: input.commandFingerprint,
      initiatorUserId: input.initiatorUserId,
      rollerActorId: execution.roller === 'SOURCE' ? input.sourceActorId : input.targetActorId,
      currentnessChecksum: input.currentnessChecksum,
      d20Policy: execution.d20Policy,
      twoPhase: execution.twoPhase,
      ...(execution.d20Belief ? { d20Belief: execution.d20Belief } : {}),
      ...(execution.heldD20 ? { heldD20: execution.heldD20 } : {}),
      ...(execution.legendaryResistance
        ? { legendaryResistance: execution.legendaryResistance }
        : {}),
      ...(execution.reactionChoice ? { reactionChoice: execution.reactionChoice } : {}),
      ...(execution.onHitChoice ? { onHitChoice: execution.onHitChoice } : {}),
      ...(execution.forcedMovementDestination
        ? { forcedMovementDestination: execution.forcedMovementDestination }
        : {}),
      ...(input.failedCounters?.length ? { failedCounters: [...input.failedCounters] } : {})
    },
    ...(execution.phaseReceipts ? { phaseReceipts: execution.phaseReceipts } : {})
  }
}

/**
 * The sealed pending snapshot of a cast held before it executes, for the creature offered the chance
 * to counter it. The continuation is that creature's reaction choice; the cast itself is not held, it
 * replays from the command once the offer is answered.
 */
export function buildEncounterCastReactionPendingSnapshot(input: {
  continuation: ServerRuleExecutionContinuationDto
  castReaction: EncounterCastReactionOfferDto
  rollerActorId: string
  optionalCombatSnapshotChecksum: string | null | undefined
  commandJson: string
  commandFingerprint: string
  initiatorUserId: string
  currentnessChecksum: string
  failedCounters: readonly EncounterFailedCounterDto[]
}): ServerKernelRuleExecutionPendingSnapshotDto {
  return {
    ...input.continuation,
    snapshotKind: 'KERNEL_EVIDENCE',
    optionalCombatSnapshotChecksum: input.optionalCombatSnapshotChecksum,
    applicationContext: {
      kind: 'ENCOUNTER_ACTION',
      schemaVersion: 1,
      commandJson: input.commandJson,
      commandFingerprint: input.commandFingerprint,
      initiatorUserId: input.initiatorUserId,
      rollerActorId: input.rollerActorId,
      currentnessChecksum: input.currentnessChecksum,
      d20Policy: null,
      twoPhase: null,
      castReaction: input.castReaction,
      ...(input.failedCounters.length ? { failedCounters: [...input.failedCounters] } : {})
    }
  }
}
