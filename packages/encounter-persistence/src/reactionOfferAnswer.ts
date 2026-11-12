import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { systemTriggerCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { readEncounterControlledActorIds } from './actorController.js'
import { readRunActors, readRunState } from './documents.js'
import { rejectDomain } from './domainRejections.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterPersistenceTransaction } from './ports.js'
import { readReactionOfferPending } from './reactionOffer.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import {
  insertRunCommand,
  presentTimelineEntry,
  requireUnusedEvidenceCommandId
} from './timelineEntries.js'

/**
 * Settles a reaction offer (D219) with the answer of the reactor's controller, or the GM's: the
 * offer closes on the Run version the answer produces, and its receipt records what was chosen. A
 * decline records nothing. An option records the one command that may run the chosen action as the
 * reactor's own, against the attacker, on that Run version; the answer itself changes no creature.
 * A stored answer replays first.
 */
export async function persistReactionOfferAnswer(
  ctx: EncounterPersistenceTransaction,
  input: { response: ResolveRuleOccurrenceInputDto; occurredAt: string }
): Promise<EncounterCommandResultDto> {
  const { response, occurredAt } = input
  const { userId } = await ctx.ports.requireIdentity()
  const { resolution } = response
  if (resolution.kind !== 'OPTION' && resolution.kind !== 'DECLINE')
    throw new Error('A reaction offer takes one of its options or a decline.')
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', response.occurrenceId))
    .unique()
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', response.encounterId))
    .unique()
  if (
    !occurrence ||
    !run ||
    occurrence.encounterId !== run.id ||
    occurrence.campaignId !== run.campaignId
  )
    throw new Error('Rule occurrence is unavailable.')
  const state = readRunState(run)
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(
    state.campaignId,
    userId
  )
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Reaction offer Campaign is stale.')
  const controlled = await readEncounterControlledActorIds(ctx, {
    campaign,
    membership,
    actors: await readRunActors(ctx, state)
  })
  const fingerprint = checksumCanonicalJson(response)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', response.commandId)
    )
    .unique()
  const evidence = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', response.commandId)
    )
    .unique()
  if (prior || evidence) {
    if (!prior || !evidence) throw new Error('Stored reaction offer answer receipt mismatch.')
    presentTimelineEntry(prior)
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(evidence.resultJson))
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(evidence.commandMetadataJson)
    )
    const answer =
      payload.status === 'AGGREGATE_CHOICE_COMPLETE' &&
      payload.applicationOutputs.kind === 'REACTION_OFFER_ANSWER'
        ? payload.applicationOutputs
        : null
    if (
      !answer ||
      !controlled.has(answer.reactorActorId) ||
      prior.actorUserId !== userId ||
      evidence.actorUserId !== userId ||
      prior.commandType !== response.type ||
      evidence.commandType !== response.type ||
      prior.encounterId !== run.id ||
      evidence.encounterId !== run.id ||
      prior.ruleOccurrenceId !== occurrence.id ||
      evidence.occurrenceId !== occurrence.id ||
      prior.commandFingerprint !== fingerprint ||
      evidence.commandFingerprint !== fingerprint ||
      evidence.correlationId !== (response.correlationId ?? null) ||
      prior.version !== response.expectedVersion + 1 ||
      evidence.encounterVersion !== prior.version ||
      prior.version > state.version ||
      occurrence.state !== 'COMPLETED' ||
      occurrence.version !== response.expectedOccurrenceVersion + 1 ||
      payload.status !== 'AGGREGATE_CHOICE_COMPLETE' ||
      payload.occurrenceId !== occurrence.id ||
      payload.occurrenceVersion !== occurrence.version ||
      evidence.resultChecksum !== checksumRuleDocument(payload) ||
      prior.ruleResultChecksum !== evidence.resultChecksum ||
      metadata.transition !== 'REACTION_OFFER' ||
      metadata.expectedAggregateVersion !== response.expectedVersion ||
      metadata.expectedOccurrenceVersion !== response.expectedOccurrenceVersion ||
      checksumCanonicalJson(metadata.response) !== checksumCanonicalJson(resolution)
    )
      throw new Error('Stored reaction offer answer receipt mismatch.')
    return presentEncounterResultForMember(ctx, {
      campaign,
      membership,
      result: await replayEncounterCommandResult(ctx, state, prior)
    })
  }
  if (
    occurrence.state !== 'PENDING' ||
    state.status !== 'ACTIVE' ||
    state.version !== response.expectedVersion ||
    occurrence.expectedEncounterVersion !== state.version ||
    occurrence.version !== response.expectedOccurrenceVersion
  )
    rejectDomain('VERSION_STALE', 'Rule occurrence is unavailable.')
  const pending = readReactionOfferPending(occurrence, await readPendingSnapshot(ctx, occurrence))
  if (!pending) throw new Error('Reaction offer is stale.')
  const { context } = pending
  if (!controlled.has(context.reactorActorId)) throw new Error('Reaction offer is unavailable.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, response.commandId)
  const usedRoot = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', campaign.id).eq('rootCommandId', response.commandId)
    )
    .unique()
  if (usedRoot) rejectDomain('COMMAND_ID_REUSED')
  const selected =
    resolution.kind === 'OPTION'
      ? context.options.find((option) => option.optionId === resolution.optionId)
      : null
  if (selected === undefined) throw new Error('Reaction offer option is unavailable.')
  const execution = storedRuleExecutionResultDtoSchema.parse({
    status: 'AGGREGATE_CHOICE_COMPLETE',
    schemaVersion: 1,
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version + 1,
    applicationOutputs: {
      kind: 'REACTION_OFFER_ANSWER',
      schemaVersion: 1,
      occurrenceId: occurrence.id,
      parentCommandId: context.parentCommandId,
      parentOccurrenceId: context.parentOccurrenceId,
      reactorActorId: context.reactorActorId,
      attackerActorId: context.attackerActorId,
      selectedOptionId: selected?.optionId ?? null,
      child: selected && {
        commandId: systemTriggerCommandId(
          context.parentCommandId,
          context.reactorActorId,
          selected.actionId
        ),
        actionId: selected.actionId
      }
    }
  })
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: occurredAt
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, nextState),
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion: execution.occurrenceVersion,
      status: 'COMPLETE',
      pending: null
    }
  })
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt: occurredAt
  })
  await ctx.db.patch(occurrence._id, {
    state: 'COMPLETED',
    version: execution.occurrenceVersion,
    expectedEncounterVersion: nextState.version,
    pendingSnapshotChecksum: await writePendingSnapshot(ctx, occurrence, null),
    completedAt: occurredAt,
    updatedAt: occurredAt
  })
  const ruleResultChecksum = checksumRuleDocument(execution)
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: response.commandId,
      commandType: response.type,
      ruleOccurrenceId: occurrence.id,
      ruleResultChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      commandFingerprint: fingerprint,
      actorUserId: userId,
      version: nextState.version,
      commandJson: JSON.stringify(response),
      ...encounterReplayReceipt(result),
      createdAt: occurredAt
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
      commandType: response.type,
      commandFingerprint: fingerprint,
      encounterVersion: nextState.version,
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'REACTION_OFFER',
          commandType: response.type,
          expectedAggregateVersion: response.expectedVersion,
          expectedOccurrenceVersion: response.expectedOccurrenceVersion,
          response: resolution
        })
      ),
      resultJson: JSON.stringify(execution),
      resultChecksum: ruleResultChecksum,
      actorUserId: userId,
      correlationId: response.correlationId ?? null,
      createdAt: occurredAt
    })
  )
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
