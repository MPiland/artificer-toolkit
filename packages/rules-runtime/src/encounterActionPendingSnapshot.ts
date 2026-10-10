import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { PendingNativeActionGraphs } from './encounterActionExecution.js'

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
      ...(execution.heldD20 ? { heldD20: execution.heldD20 } : {})
    },
    ...(execution.phaseReceipts ? { phaseReceipts: execution.phaseReceipts } : {})
  }
}
