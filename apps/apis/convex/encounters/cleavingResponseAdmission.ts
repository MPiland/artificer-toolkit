import {
  encounterCommandResultDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { cleavingChildCommandIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import type { QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { rejectDomain } from '../lib/domainRejections'
import { requireIdentity } from '../lib/identity'
import { requireActiveCampaignLiveAuthority } from '../liveSessions/authorityGuard'
import { readEncounterAutoRollByActorId, readEncounterControlledActorIds } from './actorController'
import { verifyNativeCleavingParentChain } from './cleavingParent'
import { readNativeCleavingPending } from './cleavingPending'
import { readRunActors, readRunProjection, readRunState } from './documents'
import { presentEncounterResultForMember } from './resultPresentation'
import { presentTimelineEntry, requireUnusedEvidenceCommandId } from './timelineEntries'

/**
 * Admits one Cleaving answer for the room: the responder controls the source actor, the choice is
 * the Run's current pending decision on a verified parent chain, and a stored answer replays first.
 * It reads no rules inputs and writes nothing.
 */
export async function readCleavingResponseAdmission(
  ctx: QueryCtx,
  input: Omit<LiveSessionEncounterRulesInput, 'request'> & {
    response: ResolveRuleOccurrenceInputDto
  }
) {
  const { response } = input
  const { userId } = await requireIdentity(ctx)
  if (
    userId !== input.expectedUserId ||
    response.encounterId.toLowerCase() !== input.encounterId ||
    response.expectedVersion !== input.expectedVersion
  )
    throw new Error('Live Session Cleaving response scope mismatch.')
  await requireActiveCampaignLiveAuthority(ctx, {
    campaignId: input.campaignId,
    epoch: input.authorityEpoch
  })
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', response.occurrenceId))
    .unique()
  if (!occurrence) throw new Error('Rule occurrence is unavailable.')
  if (response.resolution.kind !== 'OPTION' && response.resolution.kind !== 'DECLINE')
    throw new Error('Cleaving requires a target choice or decline.')
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run || occurrence.encounterId !== run.id || occurrence.campaignId !== run.campaignId)
    throw new Error('Cleaving occurrence scope is invalid.')
  const state = readRunState(run)
  readRunProjection(run)
  const { campaign, membership } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (
    campaign.id !== input.campaignId ||
    membership.role !== input.expectedRole ||
    campaign.status !== 'ACTIVE' ||
    campaign.gameSystemId !== state.gameSystemId
  )
    throw new Error('Cleaving Campaign is stale.')
  const actors = await readRunActors(ctx, state)
  const controlled = await readEncounterControlledActorIds(ctx, { campaign, membership, actors })
  const fingerprint = checksumCanonicalJson(response)
  const scope = { run, state, campaign, membership, actors, occurrence, fingerprint }
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
    if (!prior || !evidence || prior.commandType !== 'RESOLVE_RULE_OCCURRENCE')
      throw new Error('Stored Cleaving response receipt mismatch.')
    presentTimelineEntry(prior)
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(evidence.resultJson))
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(evidence.commandMetadataJson)
    )
    const result = encounterCommandResultDtoSchema.parse(JSON.parse(prior.resultJson))
    const sourceId =
      payload.status === 'AGGREGATE_CHOICE_COMPLETE' &&
      payload.applicationOutputs.kind === 'CLEAVING_DAMAGE'
        ? payload.applicationOutputs.sourceActorId
        : null
    const source = actors.find((actor) => actor.id === sourceId)
    if (
      !source ||
      !controlled.has(source.id) ||
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
      metadata.transition !== 'OPTIONAL_COMBAT_CLEAVING' ||
      metadata.expectedAggregateVersion !== response.expectedVersion ||
      metadata.expectedOccurrenceVersion !== response.expectedOccurrenceVersion ||
      checksumCanonicalJson(metadata.response) !== checksumCanonicalJson(response.resolution)
    )
      throw new Error('Stored Cleaving response receipt mismatch.')
    return {
      ...scope,
      kind: 'REPLAY' as const,
      result: await presentEncounterResultForMember(ctx, { campaign, membership, result })
    }
  }
  const pending = readNativeCleavingPending(occurrence)
  if (
    !pending ||
    state.status !== 'ACTIVE' ||
    state.version !== response.expectedVersion ||
    occurrence.expectedEncounterVersion !== state.version ||
    occurrence.version !== response.expectedOccurrenceVersion ||
    occurrence.rootCommandId !== cleavingChildCommandIdentity(occurrence.id)
  )
    throw new Error('Cleaving choice is stale.')
  const { context } = pending
  const sourceActor = actors.find((actor) => actor.id === context.sourceActorId)
  if (
    !sourceActor ||
    (sourceActor.kind === 'CHARACTER' ? sourceActor.sourceId : null) !==
      context.sourceControllerCharacterId ||
    !controlled.has(sourceActor.id)
  )
    throw new Error('Cleaving choice is unavailable.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, response.commandId)
  const usedRoot = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', campaign.id).eq('rootCommandId', response.commandId)
    )
    .unique()
  if (usedRoot) rejectDomain('COMMAND_ID_REUSED')
  await verifyNativeCleavingParentChain(ctx, state, context)
  const optionalSnapshot = encounterOptionalCombatSnapshotDtoSchema.parse(
    state.optionalCombatSnapshot
  )
  const definition = activeOptionalCombatDefinitions({
    automationMode: state.automationMode,
    snapshot: optionalSnapshot
  }).find(
    (entry) =>
      entry.document.kind === 'CLEAVING' &&
      entry.definitionId === context.optionalCombat.definitionId
  )
  if (
    state.optionalCombatSnapshotChecksum !== pending.snapshot.optionalCombatSnapshotChecksum ||
    checksumCanonicalJson(optionalSnapshot) !== state.optionalCombatSnapshotChecksum ||
    !definition ||
    definition.definitionChecksum !== context.optionalCombat.definitionChecksum ||
    definition.definitionVersion !== context.optionalCombat.definitionVersion
  )
    throw new Error('Cleaving rule definition is stale.')
  const resolution = response.resolution
  const selected =
    resolution.kind === 'OPTION'
      ? (context.options.find((option) => option.optionId === resolution.optionId) ?? null)
      : null
  if (
    resolution.kind === 'OPTION' &&
    (!selected ||
      (membership.role !== 'OWNER' &&
        !actors.some((actor) => actor.id === selected.targetActorId && actor.public)))
  )
    rejectDomain('TARGET_UNAVAILABLE', 'Cleaving target is unavailable.')
  return {
    ...scope,
    kind: 'READY' as const,
    pending,
    selected,
    // The answer continues the source's attack; each damaged actor's check goes to its controllers.
    autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
      campaign,
      initiatorUserId: userId,
      actors
    })
  }
}
