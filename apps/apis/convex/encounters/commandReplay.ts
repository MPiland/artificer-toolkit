import * as zMini from 'zod/mini'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto
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
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readRunProjection, readRunState } from './documents'
import { requireUnusedEvidenceCommandId } from './timelineEntries'

const projectionMetadataFields = zMini.omit(encounterGmProjectionDtoSchema, {
  actors: true,
  initiativePolicy: true,
  optionalCombatRules: true
})
const projectionMetadataSchema = projectionMetadataFields.clone({
  ...projectionMetadataFields._zod.def,
  catchall: undefined
})

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
  ctx: QueryCtx,
  {
    input,
    row,
    campaign
  }: {
    input: Exclude<EncounterCommandInputDto, { type: 'CREATE' }>
    row: Doc<'encounterRuns'>
    campaign: Doc<'campaigns'>
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
      prior.commandFingerprint !== commandFingerprint
    )
      throw new Error('Command ID was already used with different input.')
    const result = encounterCommandResultDtoSchema.parse(JSON.parse(prior.resultJson))
    const projection = encounterGmProjectionDtoSchema.parse(result.projection)
    if (
      checksumCanonicalJson(JSON.parse(prior.commandJson)) !== commandFingerprint ||
      checksumCanonicalJson(result) !== prior.resultChecksum ||
      projection.id !== row.id ||
      projection.campaignId !== campaign.id ||
      projection.gameSystemId !== campaign.gameSystemId ||
      projection.version !== prior.version ||
      prior.version !== input.expectedVersion + 1 ||
      (prior.commandType === 'ROLL_ACTOR_INITIATIVE' || prior.commandType === 'ROLL_ENEMY_ACTION'
        ? result.roll === null
        : result.roll !== null) ||
      result.resolution !== null ||
      (prior.commandType !== 'START' &&
        prior.commandType !== 'ADVANCE_TURN' &&
        result.occurrence !== null) ||
      ((prior.commandType === 'START' || prior.commandType === 'ADVANCE_TURN') &&
        result.occurrence !== null &&
        (result.occurrence.status !== 'COMPLETE' ||
          result.occurrence.pending !== null ||
          result.occurrence.outcome !== null)) ||
      (prior.commandType === 'UPDATE_ACTOR' &&
        (input.type !== 'UPDATE_ACTOR' ||
          (input.characterCommand === undefined
            ? prior.characterReceiptId !== null
            : prior.characterReceiptId === null)))
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
        provenance.equipmentId !== input.equipmentId ||
        !projection.actors.some((actor) => actor.id === input.actorId && actor.kind === 'CREATURE')
      )
        throw new Error('Stored Encounter Equipment replacement receipt mismatch.')
    }
    if (prior.commandType === 'ROLL_ACTOR_INITIATIVE') {
      if (input.type !== 'ROLL_ACTOR_INITIATIVE')
        throw new Error('Stored Encounter initiative roll receipt mismatch.')
      const target = projection.actors.find((actor) => actor.id === input.actorId)
      if (
        !target ||
        !result.roll ||
        result.roll.source.kind !== 'INITIATIVE' ||
        result.roll.characterId !== (target.kind === 'CHARACTER' ? target.sourceId : null) ||
        result.roll.ruleset.systemId !== campaign.gameSystemId
      )
        throw new Error('Stored Encounter initiative roll receipt mismatch.')
    }
    if (prior.commandType === 'ROLL_ENEMY_ACTION') {
      if (input.type !== 'ROLL_ENEMY_ACTION')
        throw new Error('Stored Encounter enemy action receipt mismatch.')
      const target = projection.actors.find((actor) => actor.id === input.actorId)
      if (!target || !result.roll || target.kind === 'CHARACTER')
        throw new Error('Stored Encounter enemy action receipt mismatch.')
      const feature = target.features.find((candidate) => candidate.id === input.featureId)
      const definition = feature?.rollDefinitions?.find(
        (candidate) => candidate.id === input.rollDefinitionId
      )
      if (
        !feature ||
        !definition ||
        result.roll.characterId !== null ||
        result.roll.characterLabel !== target.label ||
        result.roll.source.kind !== definition.kind ||
        result.roll.source.label !== enemyActionRollLabel(feature.label, definition.label) ||
        result.roll.ruleset.systemId !== campaign.gameSystemId
      )
        throw new Error('Stored Encounter enemy action receipt mismatch.')
    }
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
        snapshot.round.round !== projection.round ||
        projection.status !== 'ACTIVE' ||
        snapshot.round.status !== 'ACTIVE' ||
        snapshot.participants.length !== projection.actors.length ||
        snapshot.participants.some(
          (participant) => !projection.actors.some((actor) => actor.id === participant.actorId)
        )
      )
        throw new Error('Stored Encounter initiative correction receipt is invalid.')
      validateInitiativeCursor({
        state: snapshot,
        currentActorId: projection.currentActorId,
        actorIds: snapshot.participants.map((participant) => participant.actorId),
        // Historical side assignments live in the checksummed initiative snapshot.
        allowedSideIds: snapshot.participants.map((participant) => participant.sideId)
      })
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
        occurrence.pendingSnapshotJson !== null ||
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
        (result.occurrence !== null &&
          (result.occurrence.occurrenceId !== occurrence.id ||
            result.occurrence.occurrenceVersion !== occurrence.version))
      )
        throw new Error('Encounter replay rule receipt is invalid.')
      requireInitiativeTransition(prior.commandType, initiative, storedRuleResult.initiativeAdvance)
    }
    return { fingerprint: commandFingerprint, result }
  }
  return { fingerprint: commandFingerprint, result: null }
}

export function readNativeEncounterCommandState(row: Doc<'encounterRuns'>) {
  const state = readRunState(row)
  const projection = readRunProjection(row)
  const actorIds = new Set(projection.actors.map((actor) => actor.id))
  if (
    checksumCanonicalJson(projectionMetadataSchema.parse(state)) !==
      checksumCanonicalJson(projectionMetadataSchema.parse(projection)) ||
    actorIds.size !== projection.actors.length ||
    new Set(state.actorIds).size !== state.actorIds.length ||
    actorIds.size !== state.actorIds.length ||
    state.actorIds.some((id) => !actorIds.has(id)) ||
    projection.actors.some((actor) => actor.encounterId !== row.id) ||
    new Set(state.reminders.map((reminder) => reminder.id)).size !== state.reminders.length
  )
    throw new Error('Stored Encounter state and projection mismatch.')
  return { state, projection, actorIds }
}
