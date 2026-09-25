import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { nativeActionPendingResult, readNativeActionPending } from './actionPending'
import { readRunProjection, readRunState } from './documents'
import { presentTimelineEntry, requireUnusedEvidenceCommandId } from './timelineEntries'

/** Authorizes one action and verifies sealed replay before any fresh execution. */
export async function readNativeEncounterActionAdmission(
  ctx: QueryCtx,
  command: ResolveEncounterActionInputDto,
  userId: string,
  resume?: { occurrence: Doc<'encounterRuleOccurrences'> }
) {
  const input = {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    actorId: command.actorId.toLowerCase(),
    targetActorId: command.targetActorId.toLowerCase(),
    sceneContext: command.sceneContext
      ? {
          ...command.sceneContext,
          sceneId: command.sceneContext.sceneId.toLowerCase(),
          sourceTokenId: command.sceneContext.sourceTokenId.toLowerCase(),
          targetTokenId: command.sceneContext.targetTokenId.toLowerCase()
        }
      : null
  }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const state = readRunState(run)
  readRunProjection(run)
  const { campaign, membership } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign System is stale.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const fingerprint = checksumCanonicalJson(input)
  const replay = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (replay) {
    presentTimelineEntry(replay)
    if (
      replay.commandType !== 'RESOLVE_ACTION' ||
      replay.encounterId !== run.id ||
      replay.actorUserId !== userId ||
      replay.version !== input.expectedVersion + 1 ||
      replay.version > state.version ||
      replay.commandFingerprint !== fingerprint
    )
      throw new Error('Command ID was already used with different input.')
    const result = encounterCommandResultDtoSchema.parse(JSON.parse(replay.resultJson))
    if (
      checksumCanonicalJson(JSON.parse(replay.commandJson)) !== fingerprint ||
      checksumCanonicalJson(result) !== replay.resultChecksum ||
      result.projection.id !== run.id ||
      result.projection.campaignId !== campaign.id ||
      result.projection.version !== replay.version
    )
      throw new Error('Stored Encounter action receipt mismatch.')
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (query) => query.eq('id', replay.ruleOccurrenceId))
      .unique()
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (query) =>
        query.eq('encounterId', run.id).eq('commandId', input.commandId)
      )
      .unique()
    if (!occurrence || !receipt) throw new Error('Stored Encounter action receipt mismatch.')
    const { _id: _occurrenceId, _creationTime: _occurrenceTime, ...storedOccurrence } = occurrence
    encounterStoredRuleOccurrenceSchema.parse(storedOccurrence)
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (payload.status !== 'COMPLETE') throw new Error('Stored Encounter action receipt mismatch.')
    const initialExecution = payload.phaseReceipts?.[0]?.execution ?? payload
    const terminalExecution = payload.phaseReceipts?.at(-1)?.execution ?? payload
    if (
      checksumRuleDocument({
        outputs: terminalExecution.outputs,
        evidence: terminalExecution.evidence
      }) !==
      checksumRuleDocument({
        outputs: payload.outputs,
        evidence: payload.evidence
      })
    )
      throw new Error('Stored Encounter action phase receipt mismatch.')
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    const sourceProjectionActor = result.projection.actors.find(
      (actor) => actor.id === input.actorId
    )
    const targetProjectionActor = result.projection.actors.find(
      (actor) => actor.id === input.targetActorId
    )
    const characterBatch =
      payload.applicationOutputs.kind === 'CHARACTER_MECHANICS_BATCH'
        ? payload.applicationOutputs
        : null
    if (
      occurrence.state !== 'COMPLETED' ||
      occurrence.encounterId !== run.id ||
      occurrence.campaignId !== campaign.id ||
      occurrence.rootCommandId !== input.commandId ||
      occurrence.expectedEncounterVersion !== replay.version ||
      receipt.campaignId !== campaign.id ||
      receipt.occurrenceId !== occurrence.id ||
      receipt.commandType !== 'RESOLVE_ACTION' ||
      receipt.commandFingerprint !== fingerprint ||
      receipt.encounterVersion !== replay.version ||
      receipt.actorUserId !== userId ||
      receipt.correlationId !== null ||
      receipt.resultChecksum !== checksumRuleDocument(payload) ||
      receipt.resultChecksum !== replay.ruleResultChecksum ||
      payload.occurrenceId !== occurrence.id ||
      payload.occurrenceVersion !== occurrence.version ||
      (payload.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
        payload.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH') ||
      payload.applicationOutputs.occurrenceId !== occurrence.id ||
      payload.applicationOutputs.sourceActorId !== input.actorId ||
      payload.applicationOutputs.targetActorId !== input.targetActorId ||
      metadata.transition !== 'START' ||
      metadata.definitionId !== initialExecution.evidence.source.definitionId ||
      (payload.initialFactsChecksum !== undefined
        ? metadata.factsChecksum !== payload.initialFactsChecksum ||
          (payload.phaseReceipts !== undefined &&
            payload.initialFactsChecksum !== payload.phaseReceipts[0]?.boundFactsChecksum)
        : metadata.factsChecksum !==
          (payload.phaseReceipts?.[0]?.boundFactsChecksum ??
            checksumRuleDocument(initialExecution.evidence.facts))) ||
      metadata.expectedAggregateVersion !== input.expectedVersion ||
      metadata.optionalCombatSnapshotChecksum !== replay.optionalCombatSnapshotChecksum ||
      result.occurrence?.status !== 'COMPLETE' ||
      result.occurrence.occurrenceId !== occurrence.id ||
      result.occurrence.occurrenceVersion !== occurrence.version ||
      result.occurrence.pending !== null ||
      result.occurrence.outcome !== null ||
      result.roll !== null ||
      result.resolution !== null
    )
      throw new Error('Stored Encounter action receipt mismatch.')
    if (
      characterBatch &&
      (!sourceProjectionActor ||
        !targetProjectionActor ||
        targetProjectionActor.kind !== 'CHARACTER' ||
        targetProjectionActor.sourceId === null ||
        (characterBatch.sourceCharacterId === null
          ? sourceProjectionActor.kind === 'CHARACTER'
          : sourceProjectionActor.kind !== 'CHARACTER' ||
            sourceProjectionActor.sourceId !== characterBatch.sourceCharacterId))
    )
      throw new Error('Stored Encounter Character action receipt mismatch.')
    return { kind: 'REPLAY' as const, input, run, state, campaign, fingerprint, result }
  }
  if (state.version !== input.expectedVersion) throw new Error('Encounter version is stale.')
  if (state.status !== 'ACTIVE') throw new Error('Actions require an active Encounter.')
  if (state.automationMode === 'MANUAL')
    throw new Error('Native action execution requires Automatic or Assisted Encounter mode.')
  if (state.currentActorId !== input.actorId)
    throw new Error('The selected actor does not have the turn.')
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (query) =>
      query.eq('encounterId', run.id).eq('state', 'PENDING')
    )
    .take(2)
  if (pending.length > 1) throw new Error('Stored Encounter occurrence state is invalid.')
  if (pending.length === 1) {
    const occurrence = pending[0]!
    if (occurrence.rootCommandId !== input.commandId)
      throw new Error('An Encounter rule occurrence is awaiting resolution.')
    const { context } = readNativeActionPending(occurrence)
    if (context.commandFingerprint !== fingerprint || context.initiatorUserId !== userId)
      throw new Error('Command ID was already used with different input.')
    if (!resume)
      return {
        kind: 'REPLAY' as const,
        input,
        run,
        state,
        campaign,
        fingerprint,
        result: nativeActionPendingResult(run, occurrence)
      }
    if (
      resume.occurrence._id !== occurrence._id ||
      resume.occurrence.version !== occurrence.version
    )
      throw new Error('The action occurrence version is stale.')
  } else if (resume) throw new Error('The action occurrence is no longer pending.')
  const usedRoot = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (query) =>
      query.eq('campaignId', campaign.id).eq('rootCommandId', input.commandId)
    )
    .unique()
  if (usedRoot && usedRoot._id !== resume?.occurrence._id)
    throw new Error('Command ID was already used with different input.')

  return {
    kind: 'READY' as const,
    input,
    run,
    state: { ...state, automationMode: state.automationMode },
    campaign,
    fingerprint
  }
}
