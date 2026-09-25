import {
  encounterCommandResultDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readRunActors, readRunProjection, readRunState } from './documents'
import { readEncounterControlledActorIds } from './actorController'
import { readNativeConcentrationPending } from './concentrationPending'
import { readNativeConcentrationParentDamage } from './concentrationParent'
import { presentTimelineEntry } from './timelineEntries'
import { isNativeConcentrationOccurrence } from './occurrenceOwner'
import { rejectDomain } from '../lib/domainRejections'
import { presentEncounterResultForMember } from './resultPresentation'
import { readEncounterSettledAppRoll } from './evidenceRolls'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'

/** Admits one concentration child response without preparing facts or writing state. */
export async function readNativeConcentrationResponseAdmission(
  ctx: QueryCtx,
  response: ResolveRuleOccurrenceInputDto,
  userId: string
) {
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', response.occurrenceId))
    .unique()
  if (!occurrence || !isNativeConcentrationOccurrence(occurrence)) return null
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', response.encounterId))
    .unique()
  if (!run || occurrence.encounterId !== run.id || occurrence.campaignId !== run.campaignId)
    throw new Error('The concentration occurrence is unavailable.')
  const state = readRunState(run)
  const projection = readRunProjection(run)
  const { campaign, membership } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('The concentration occurrence is unavailable.')
  const actors = await readRunActors(ctx, state)
  const controlled = await readEncounterControlledActorIds(ctx, { campaign, membership, actors })
  const authorized = (targetActorId: string) =>
    actors.some(
      (actor) =>
        actor.id === targetActorId && actor.kind === 'CHARACTER' && controlled.has(actor.id)
    )
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
    if (!prior || !evidence || prior.commandType !== 'RESOLVE_RULE_OCCURRENCE')
      throw new Error('The concentration occurrence is unavailable.')
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(evidence.resultJson))
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(evidence.commandMetadataJson)
    )
    const result = encounterCommandResultDtoSchema.parse(JSON.parse(prior.resultJson))
    presentTimelineEntry(prior)
    if (
      payload.status !== 'COMPLETE' ||
      payload.applicationOutputs.kind !== 'CONCENTRATION_CHECK' ||
      !authorized(payload.applicationOutputs.application.targetActorId) ||
      prior.actorUserId !== userId ||
      evidence.actorUserId !== userId ||
      prior.encounterId !== run.id ||
      evidence.encounterId !== run.id ||
      evidence.commandType !== response.type ||
      prior.commandFingerprint !== fingerprint ||
      evidence.commandFingerprint !== fingerprint ||
      evidence.correlationId !== (response.correlationId ?? null) ||
      prior.ruleOccurrenceId !== occurrence.id ||
      evidence.occurrenceId !== occurrence.id ||
      payload.occurrenceId !== occurrence.id ||
      occurrence.state !== 'COMPLETED' ||
      occurrence.version !== response.expectedOccurrenceVersion + 1 ||
      payload.occurrenceVersion !== occurrence.version ||
      prior.version !==
        response.expectedVersion +
          (payload.applicationOutputs.outcome === 'SAVE_FAILURE' ? 1 : 0) ||
      evidence.encounterVersion !== prior.version ||
      prior.version > state.version ||
      occurrence.expectedEncounterVersion !== prior.version ||
      checksumRuleDocument(payload) !== evidence.resultChecksum ||
      prior.ruleResultChecksum !== evidence.resultChecksum ||
      metadata.transition !== 'RESUME' ||
      metadata.expectedAggregateVersion !== response.expectedVersion ||
      metadata.expectedOccurrenceVersion !== response.expectedOccurrenceVersion ||
      (response.resolution.kind !== 'ENTER_DICE' && response.resolution.kind !== 'SYSTEM_ROLL') ||
      metadata.response.requestId !== response.resolution.requestId ||
      metadata.response.value !== payload.applicationOutputs.d20.selectedNatural ||
      (response.resolution.kind === 'ENTER_DICE' &&
        checksumCanonicalJson(response.resolution.rawFaces) !==
          checksumCanonicalJson(payload.applicationOutputs.d20.rawFaces))
    )
      throw new Error('The concentration occurrence is unavailable.')
    return {
      kind: 'REPLAY' as const,
      result: await presentEncounterResultForMember(ctx, { campaign, membership, result }),
      state,
      run,
      campaign,
      membership,
      actors,
      projection,
      fingerprint,
      occurrence
    }
  }
  const pending = readNativeConcentrationPending(occurrence)
  const { context, snapshot } = pending
  if (!authorized(context.application.targetActorId))
    throw new Error('The concentration occurrence is unavailable.')
  const reservedCommand = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', campaign.id).eq('rootCommandId', response.commandId)
    )
    .unique()
  if (reservedCommand) rejectDomain('COMMAND_ID_REUSED')
  const appRoll = await readEncounterSettledAppRoll(ctx, { occurrence, response, userId })
  const resolution = withEncounterAppRoll(response.resolution, appRoll)
  if (
    state.automationMode === 'MANUAL' ||
    state.status !== 'ACTIVE' ||
    state.version !== response.expectedVersion ||
    occurrence.expectedEncounterVersion !== state.version ||
    occurrence.version !== response.expectedOccurrenceVersion ||
    snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
    (resolution.kind !== 'ENTER_DICE' && resolution.kind !== 'SYSTEM_ROLL')
  )
    throw new Error('The concentration occurrence is unavailable.')
  const pendingOccurrences = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', state.id).eq('state', 'PENDING'))
    .take(2)
  if (pendingOccurrences.length !== 1 || pendingOccurrences[0]?.id !== occurrence.id)
    throw new Error('The concentration occurrence is unavailable.')
  const parentApplications = await readNativeConcentrationParentDamage(ctx, { state, context })
  const applicationIndex = parentApplications.findIndex(
    (application) => checksumRuleDocument(application) === checksumRuleDocument(context.application)
  )
  if (
    checksumRuleDocument(parentApplications) !== context.finalizedDamageEnvelopeChecksum ||
    applicationIndex < 0
  )
    throw new Error('The concentration damage does not match its finalized parent receipt.')
  return {
    kind: 'READY' as const,
    state,
    run,
    campaign,
    membership,
    actors,
    projection,
    fingerprint,
    occurrence,
    pending,
    parentApplications,
    applicationIndex,
    resolution,
    appRoll
  }
}
