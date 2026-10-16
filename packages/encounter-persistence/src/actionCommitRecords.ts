import type { z } from 'zod'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { changedFields } from './documents.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { insertRunCommand } from './timelineEntries.js'
import type { EncounterDocument, EncounterWriteContext } from './store.js'

/**
 * Settles an action's root occurrence as COMPLETED, patching the pending one a response resumed. A
 * resumed action settles its own occurrence first, so a child opens as the only pending one.
 */
export async function completeActionOccurrence(
  ctx: EncounterWriteContext,
  input: {
    state: EncounterRunState
    nextState: EncounterRunState
    occurrenceId: string
    rootCommandId: string
    version: number
    resume: { occurrence: EncounterDocument<'encounterRuleOccurrences'> } | null
    occurredAt: string
  }
) {
  const { state, resume } = input
  const completedOccurrence = encounterStoredRuleOccurrenceSchema.parse({
    id: input.occurrenceId,
    campaignId: state.campaignId,
    encounterId: state.id,
    rootCommandId: input.rootCommandId,
    state: 'COMPLETED',
    version: input.version,
    expectedEncounterVersion: input.nextState.version,
    pendingSnapshotChecksum: await writePendingSnapshot(
      ctx,
      { id: input.occurrenceId, encounterId: state.id },
      null
    ),
    completedAt: input.occurredAt,
    createdAt: resume?.occurrence.createdAt ?? input.occurredAt,
    updatedAt: input.occurredAt
  })
  if (resume)
    await ctx.db.patch(resume.occurrence._id, changedFields(resume.occurrence, completedOccurrence))
  else await ctx.db.insert('encounterRuleOccurrences', completedOccurrence)
  return completedOccurrence
}

/**
 * Records a committed action: advances the Run, stores the root's one receipt and inserts the one
 * RESOLVE_ACTION command a replay and an undo find it by.
 */
export async function recordActionRoot(
  ctx: EncounterWriteContext,
  input: {
    run: EncounterDocument<'encounterRuns'>
    state: EncounterRunState
    nextState: EncounterRunState
    command: ResolveEncounterActionInputDto
    fingerprint: string
    initiatorUserId: string
    execution: StoredRuleExecutionResultDto
    definitionId: string
    /** Validated by the receipt metadata schema; a single-target result may not carry one. */
    factsChecksum: string | undefined
    result: EncounterCommandResultDto
    commandFields: Pick<
      Extract<z.infer<typeof encounterStoredRunCommandSchema>, { commandType: 'RESOLVE_ACTION' }>,
      | 'label'
      | 'ruleOverrides'
      | 'consumedGrants'
      | 'addedConcentrationCasterId'
      | 'speedBonusTurn'
      | 'turnUses'
    > &
      Partial<
        Pick<
          Extract<
            z.infer<typeof encounterStoredRunCommandSchema>,
            { commandType: 'RESOLVE_ACTION' }
          >,
          'issuerLines' | 'gmLines'
        >
      >
    occurredAt: string
  }
) {
  const { state, nextState, command, execution } = input
  const ruleResultChecksum = checksumRuleDocument(execution)
  await ctx.db.patch(input.run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt: input.occurredAt
  })
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: state.campaignId,
      encounterId: state.id,
      occurrenceId: execution.occurrenceId,
      commandId: command.commandId,
      commandType: 'RESOLVE_ACTION',
      commandFingerprint: input.fingerprint,
      encounterVersion: nextState.version,
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'START',
          definitionId: input.definitionId,
          expectedAggregateVersion: state.version,
          factsChecksum: input.factsChecksum,
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      ),
      resultJson: JSON.stringify(execution),
      resultChecksum: ruleResultChecksum,
      actorUserId: input.initiatorUserId,
      correlationId: null,
      createdAt: input.occurredAt
    })
  )
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: state.campaignId,
      encounterId: state.id,
      commandId: command.commandId,
      commandType: 'RESOLVE_ACTION',
      root: {
        kind: 'RULE_OCCURRENCE',
        ruleOccurrenceId: execution.occurrenceId,
        ruleResultChecksum,
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
      },
      ...input.commandFields,
      commandFingerprint: input.fingerprint,
      actorUserId: input.initiatorUserId,
      version: nextState.version,
      commandJson: JSON.stringify(command),
      ...encounterReplayReceipt(input.result),
      createdAt: input.occurredAt
    })
  )
}
