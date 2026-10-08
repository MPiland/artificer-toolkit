import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionEncounterBasicActionResponseCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { readBasicActionCheckResponseAdmission } from './basicActionCheckAdmission.js'
import { settleEncounterBasicActionCheck } from './basicActionCheckSettlement.js'
import { readEncounterCharacterStates } from './characterStates.js'
import { changedFields, readRunActors } from './documents.js'
import { readEncounterInitiativeRound } from './initiativeStore.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import type { EncounterWriteTransaction } from './ports.js'

/**
 * Commits the helper's d20 for a pending basic action check (First Aid): the stabilize it earned,
 * the occurrence's completion and the receipts, atomically. The root command already spent the
 * Action, so a failed check changes only the occurrence.
 */
export async function persistEncounterBasicActionResponse(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterBasicActionResponseCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      characterIds: readonly string[],
      revisions: LiveSessionRulesRevisions
    ): Promise<void>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readBasicActionCheckResponseAdmission(ctx, {
    ...input,
    response: input.command
  })
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, occurrence, pending, fingerprint, response } = admission
  const { context, continuation } = pending
  const { settlement } = input
  const { execution } = settlement
  const natural =
    execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'BASIC_ACTION_CHECK'
      ? execution.applicationOutputs.d20.selectedNatural
      : null
  const actors = await readRunActors(ctx, state)
  await callbacks.validateReadFence(
    state,
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : [])),
    input.revisions
  )
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    checksumCanonicalJson(settlement.context) !== checksumCanonicalJson(context) ||
    execution.status !== 'COMPLETE' ||
    natural === null ||
    execution.occurrenceId !== occurrence.id ||
    execution.initialFactsChecksum !== checksumRuleDocument(continuation.facts) ||
    execution.evidence.source.gameSystemId !== state.gameSystemId ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId)) ||
    (settlement.appRollId !== null) !== (admission.appRoll !== null) ||
    (admission.appRoll !== null && settlement.appRollId !== admission.appRoll.rollId)
  )
    throw new Error('Live Session basic action check result does not match its pending evidence.')
  const occurrenceVersion = occurrence.version + 1
  const settled = await settleEncounterBasicActionCheck(ctx, {
    campaign,
    state,
    actors,
    settlement,
    rootCommandId: context.commandId,
    initiatorUserId: admission.initiatorUserId,
    occurredAt: input.occurredAt,
    occurrenceVersion,
    applyMechanics: callbacks.applyMechanics
  })
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const projection = projectCurrentEncounterGm({
    state: nextState,
    actors: settled.actors,
    rules: input.rules,
    initiativeRoundState: await readEncounterInitiativeRound(ctx, {
      encounterId: state.id,
      round: state.round
    }),
    characterStates: await readEncounterCharacterStates(ctx, nextState, settled.actors)
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion,
      status: 'COMPLETE',
      pending: null
    }
  })
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt: input.occurredAt
  })
  const completed = encounterStoredRuleOccurrenceSchema.parse({
    id: occurrence.id,
    campaignId: campaign.id,
    encounterId: run.id,
    rootCommandId: occurrence.rootCommandId,
    state: 'COMPLETED',
    version: occurrenceVersion,
    expectedEncounterVersion: nextState.version,
    pendingSnapshotChecksum: await writePendingSnapshot(
      ctx,
      { id: occurrence.id, encounterId: run.id },
      null
    ),
    completedAt: input.occurredAt,
    createdAt: occurrence.createdAt,
    updatedAt: input.occurredAt
  })
  await ctx.db.patch(occurrence._id, changedFields(occurrence, completed))
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: response.commandId,
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      ruleOccurrenceId: occurrence.id,
      ruleResultChecksum: checksumRuleDocument(execution),
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      commandFingerprint: fingerprint,
      actorUserId: input.expectedUserId,
      version: nextState.version,
      commandJson: JSON.stringify(response),
      ...encounterReplayReceipt(result),
      createdAt: input.occurredAt
    })
  )
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      occurrenceId: occurrence.id,
      commandId: response.commandId,
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      commandFingerprint: fingerprint,
      encounterVersion: nextState.version,
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'RESUME',
          expectedAggregateVersion: response.expectedVersion,
          expectedOccurrenceVersion: response.expectedOccurrenceVersion,
          response: { requestId: continuation.request.requestId, value: natural },
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      ),
      resultJson: JSON.stringify(execution),
      resultChecksum: checksumRuleDocument(execution),
      actorUserId: input.expectedUserId,
      correlationId: response.correlationId ?? null,
      createdAt: input.occurredAt
    })
  )
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
