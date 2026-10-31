import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { EncounterActionPauseDto } from '@artificer-toolkit/schema/shared/encounterPause'
import type { EncounterFailedCounterDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
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
  // A held cast, ward or retarget pauses before the graphs run, so the graphs resume none of them.
  const { pause } = context
  const graphPause =
    pause?.kind === 'D20_WINDOW' ||
    pause?.kind === 'LEGENDARY_RESISTANCE' ||
    pause?.kind === 'REACTION' ||
    pause?.kind === 'ON_HIT' ||
    pause?.kind === 'FORCED_MOVEMENT'
      ? pause
      : null
  return {
    kind: 'PENDING',
    continuation: pendingSnapshotContinuation(snapshot),
    d20Policy: context.d20Policy,
    twoPhase: context.twoPhase,
    ...(context.d20Belief ? { d20Belief: context.d20Belief } : {}),
    ...(context.heldD20 ? { heldD20: context.heldD20 } : {}),
    ...(graphPause ? { pause: graphPause } : {}),
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
  passedIncomingGate?: string
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
      ...(execution.pause ? { pause: execution.pause } : {}),
      ...(input.failedCounters?.length ? { failedCounters: [...input.failedCounters] } : {}),
      ...(input.passedIncomingGate ? { passedIncomingGate: input.passedIncomingGate } : {})
    },
    ...(execution.phaseReceipts ? { phaseReceipts: execution.phaseReceipts } : {})
  }
}

/**
 * The sealed pending snapshot of an action held before it executes: a cast waiting on a creature's
 * chance to counter it, an attacker owing the save against a warded target's gate, or an action a ward
 * stopped waiting on its attacker's choice to turn it on another creature. The continuation is the
 * pause; the action itself is not held, it replays from the command once the pause is answered.
 */
export function buildEncounterHeldActionPendingSnapshot(input: {
  continuation: ServerRuleExecutionContinuationDto
  pause: Extract<
    EncounterActionPauseDto,
    { kind: 'CAST_REACTION' | 'INCOMING_GATE' | 'ATTACK_RETARGET' }
  >
  rollerActorId: string
  optionalCombatSnapshotChecksum: string | null | undefined
  commandJson: string
  commandFingerprint: string
  initiatorUserId: string
  currentnessChecksum: string
  failedCounters?: readonly EncounterFailedCounterDto[]
  passedIncomingGate?: string
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
      pause: input.pause,
      ...(input.failedCounters?.length ? { failedCounters: [...input.failedCounters] } : {}),
      ...(input.passedIncomingGate ? { passedIncomingGate: input.passedIncomingGate } : {})
    }
  }
}
