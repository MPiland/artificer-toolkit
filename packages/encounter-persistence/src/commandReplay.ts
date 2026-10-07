import type {
  EncounterCommandInputDto,
  EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterInitiativeRoundStateDtoSchema } from '@artificer-toolkit/schema/shared/initiativeState'
import { encounterCreatureEquipmentReplacementSchema } from '@artificer-toolkit/schema/projections/encounterCreatureEquipment'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type {
  EncounterInitiativeAdvancePlanDto,
  EncounterInitiativeSettlementDto
} from '@artificer-toolkit/schema/shared/ruleExecutionInitiative'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readRunState } from './documents.js'
import { readEncounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { requireUnusedEvidenceCommandId } from './timelineEntries.js'
import { rejectDomain } from './domainRejections.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

export function requireInitiativeTransition(
  commandType: 'START' | 'ADVANCE_TURN',
  settlement: EncounterInitiativeSettlementDto | null,
  advance: EncounterInitiativeAdvancePlanDto | null
): void {
  if (commandType === 'START') {
    if (!settlement || settlement.round !== 1 || advance !== null)
      throw new Error('Encounter initiative transition is inconsistent.')
    return
  }
  if (!advance) throw new Error('Encounter initiative transition is inconsistent.')
  if (advance.kind !== 'ROUND_WRAP' || advance.cadence !== 'EACH_ROUND') {
    if (settlement !== null) throw new Error('Encounter initiative transition is inconsistent.')
    return
  }
  if (
    !settlement ||
    settlement.cadence !== 'EACH_ROUND' ||
    settlement.round !== advance.nextRound ||
    checksumCanonicalJson([...settlement.orderedActorIds].sort()) !==
      checksumCanonicalJson([...advance.orderedActorIds].sort()) ||
    checksumCanonicalJson([...settlement.orderedSideIds].sort()) !==
      checksumCanonicalJson([...advance.orderedSideIds].sort())
  )
    throw new Error('Encounter initiative transition is inconsistent.')
}

export function enemyActionRollLabel(featureLabel: string, definitionLabel: string): string {
  return `${featureLabel}: ${definitionLabel}`.slice(0, 80).trim()
}

export async function readNativeEncounterCommandReplay(
  ctx: EncounterReadTransaction,
  {
    input,
    row,
    campaign,
    userId
  }: {
    input: Exclude<EncounterCommandInputDto, { type: 'CREATE' }>
    row: EncounterDocument<'encounterRuns'>
    campaign: EncounterDocument<'campaigns'>
    /** A replay by command ID returns only to the user who issued the command. */
    userId: string
  }
): Promise<{ fingerprint: string; result: EncounterCommandResultDto | null }> {
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const commandFingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.commandType === 'CREATE' ||
      prior.commandType !== input.type ||
      prior.encounterId !== row.id ||
      prior.commandFingerprint !== commandFingerprint ||
      prior.actorUserId !== userId
    )
      rejectDomain('COMMAND_ID_REUSED')
    const receipt = readEncounterReplayReceipt(prior)
    if (
      checksumCanonicalJson(JSON.parse(prior.commandJson)) !== commandFingerprint ||
      prior.version !== input.expectedVersion + 1 ||
      prior.version > row.version ||
      (prior.commandType === 'ROLL_ACTOR_INITIATIVE' || prior.commandType === 'ROLL_ENEMY_ACTION'
        ? receipt.roll === null
        : receipt.roll !== null) ||
      (prior.commandType !== 'START' &&
        prior.commandType !== 'ADVANCE_TURN' &&
        receipt.occurrence !== null) ||
      ((prior.commandType === 'START' || prior.commandType === 'ADVANCE_TURN') &&
        receipt.occurrence !== null &&
        (receipt.occurrence.status !== 'COMPLETE' || receipt.occurrence.pending !== null)) ||
      (prior.commandType === 'UPDATE_ACTOR' && input.type !== 'UPDATE_ACTOR')
    )
      throw new Error('Stored Encounter command receipt mismatch.')
    if (prior.commandType === 'REPLACE_CREATURE_EQUIPMENT') {
      const provenance = encounterCreatureEquipmentReplacementSchema.parse(
        prior.creatureEquipmentReplacement
      )
      if (
        input.type !== 'REPLACE_CREATURE_EQUIPMENT' ||
        provenance.actorId !== input.actorId ||
        provenance.loadoutEntryId !== input.loadoutEntryId ||
        provenance.equipmentId !== input.equipmentId
      )
        throw new Error('Stored Encounter Equipment replacement receipt mismatch.')
    }
    if (
      (prior.commandType === 'ROLL_ACTOR_INITIATIVE' &&
        (input.type !== 'ROLL_ACTOR_INITIATIVE' || receipt.roll?.source.kind !== 'INITIATIVE')) ||
      (prior.commandType === 'ROLL_ENEMY_ACTION' &&
        (input.type !== 'ROLL_ENEMY_ACTION' || receipt.roll?.characterId !== null)) ||
      (receipt.roll !== null && receipt.roll.ruleset.systemId !== campaign.gameSystemId)
    )
      throw new Error('Stored Encounter roll receipt mismatch.')
    if (
      prior.commandType === 'PREVIOUS_TURN' ||
      prior.commandType === 'SET_CURRENT_ACTOR' ||
      prior.commandType === 'SET_ROUND'
    ) {
      const snapshot = encounterInitiativeRoundStateDtoSchema.parse(
        JSON.parse(prior.initiativeStateJson)
      )
      if (
        checksumCanonicalJson(snapshot) !== prior.initiativeStateChecksum ||
        snapshot.round.encounterId !== row.id ||
        snapshot.round.status !== 'ACTIVE'
      )
        throw new Error('Stored Encounter initiative correction receipt is invalid.')
    }
    const storedReceipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', row.id).eq('commandId', input.commandId)
      )
      .unique()
    if (prior.commandType !== 'START' && prior.commandType !== 'ADVANCE_TURN') {
      if (storedReceipt) throw new Error('Encounter replay rule receipt is inconsistent.')
    } else {
      const occurrence = await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (q) => q.eq('id', prior.ruleOccurrenceId))
        .unique()
      if (!occurrence || !storedReceipt)
        throw new Error('Encounter replay rule receipt is unavailable.')
      const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
        JSON.parse(storedReceipt.commandMetadataJson)
      )
      const storedRuleResult = storedRuleExecutionResultDtoSchema.parse(
        JSON.parse(storedReceipt.resultJson)
      )
      if (
        storedRuleResult.status !== 'INITIATIVE_COMPLETE' &&
        storedRuleResult.status !== 'TURN_LIFECYCLE_COMPLETE' &&
        storedRuleResult.status !== 'MANUAL' &&
        !(
          storedRuleResult.status === 'BATCH_COMPLETE' &&
          storedRuleResult.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
        )
      )
        throw new Error('Encounter replay turn receipt is invalid.')
      const initiative = storedRuleResult.initiative
      if (
        occurrence.campaignId !== campaign.id ||
        occurrence.encounterId !== row.id ||
        occurrence.rootCommandId !== input.commandId ||
        occurrence.state !== 'COMPLETED' ||
        occurrence.expectedEncounterVersion !== prior.version ||
        occurrence.pendingSnapshotChecksum !== null ||
        occurrence.completedAt === null ||
        storedReceipt.campaignId !== campaign.id ||
        storedReceipt.encounterId !== row.id ||
        storedReceipt.occurrenceId !== occurrence.id ||
        storedReceipt.commandId !== input.commandId ||
        storedReceipt.commandType !== prior.commandType ||
        storedReceipt.commandFingerprint !== commandFingerprint ||
        storedReceipt.encounterVersion !== prior.version ||
        storedReceipt.actorUserId !== prior.actorUserId ||
        storedReceipt.correlationId !== null ||
        checksumCanonicalJson(storedRuleResult) !== storedReceipt.resultChecksum ||
        prior.ruleResultChecksum !== storedReceipt.resultChecksum ||
        metadata.transition !== 'TURN_EFFECTS' ||
        metadata.commandType !== prior.commandType ||
        metadata.expectedAggregateVersion !== input.expectedVersion ||
        metadata.selectionChecksum !== null ||
        metadata.initiativeChecksum !==
          (initiative === null ? null : checksumCanonicalJson(initiative)) ||
        (prior.commandType === 'START' && metadata.initiativeAdvanceChecksum !== null) ||
        metadata.optionalCombatSnapshotChecksum !== prior.optionalCombatSnapshotChecksum ||
        metadata.terminalOccurrenceVersion !== occurrence.version ||
        metadata.resolutionCommands.length !== occurrence.version ||
        storedRuleResult.occurrenceId !== occurrence.id ||
        storedRuleResult.occurrenceVersion !== occurrence.version ||
        (storedRuleResult.status !== 'MANUAL' &&
          (storedRuleResult.encounterId !== row.id ||
            storedRuleResult.commandType !== prior.commandType)) ||
        (prior.commandType === 'START' &&
          (initiative === null || storedRuleResult.initiativeAdvance !== null)) ||
        (prior.commandType === 'ADVANCE_TURN' &&
          (storedRuleResult.initiativeAdvance === null ||
            metadata.initiativeAdvanceChecksum !==
              checksumCanonicalJson(storedRuleResult.initiativeAdvance))) ||
        (receipt.occurrence !== null &&
          (receipt.occurrence.occurrenceId !== occurrence.id ||
            receipt.occurrence.occurrenceVersion !== occurrence.version))
      )
        throw new Error('Encounter replay rule receipt is invalid.')
      requireInitiativeTransition(prior.commandType, initiative, storedRuleResult.initiativeAdvance)
    }
    return {
      fingerprint: commandFingerprint,
      result: await replayEncounterCommandResult(ctx, readRunState(row), prior)
    }
  }
  return { fingerprint: commandFingerprint, result: null }
}
