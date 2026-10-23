import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { insertCheckOccurrence } from './basicActionPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/**
 * Stores the pending ability check a spell cast pends for its candidates (D182): the cast's one
 * pending occurrence, waiting on the first candidate's d20 under the cast's own command. The Worker
 * froze the candidates and the d20; this only proves the snapshot belongs to this cast.
 */
export async function insertSpellCastCheck(
  ctx: EncounterCharacterWriteTransaction,
  args: {
    snapshot: ServerRuleExecutionPendingSnapshotDto
    input: LiveSessionEncounterActionCommitInput
    nextState: EncounterRunState
    executionOccurrenceId: string
    sourceActorId: string
  }
) {
  const { snapshot, input, nextState } = args
  const context = snapshot.applicationContext
  if (
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    context.kind !== 'ENCOUNTER_CHECK_ACTION' ||
    context.phase.kind !== 'CHECK' ||
    context.source.kind !== 'SPELL_CAST' ||
    context.source.castOccurrenceId !== args.executionOccurrenceId ||
    context.commandId !== input.command.commandId ||
    context.actorId !== args.sourceActorId ||
    context.candidates?.cursor !== 0 ||
    context.candidates.entries[0]?.dc !== context.check.dc ||
    snapshot.optionalCombatSnapshotChecksum !== nextState.optionalCombatSnapshotChecksum ||
    input.pendingConcentration
  )
    throw new Error('Live Session spell check scope mismatch.')
  const occurrence = await insertCheckOccurrence(ctx, {
    campaignId: nextState.campaignId,
    encounterId: nextState.id,
    rootCommandId: input.command.commandId,
    expectedEncounterVersion: nextState.version,
    check: { kind: 'PENDING', snapshot },
    occurredAt: input.occurredAt
  })
  return { occurrence, snapshot }
}
