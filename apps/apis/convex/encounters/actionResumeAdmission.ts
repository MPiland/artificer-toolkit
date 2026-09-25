import {
  encounterExecuteInputSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRuleReceiptSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readNativeEncounterActionAdmission } from './actionAdmission'
import {
  canAnswerNativeActionEvidence,
  nativeActionPendingResult,
  readNativeActionPending
} from './actionPending'
import { requireCampaignAuthority } from '../campaigns/authority'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { readEncounterSettledAppRoll } from './evidenceRolls'
import { isNativeActionOccurrence } from './occurrenceOwner'
import { rejectDomain } from '../lib/domainRejections'

/**
 * Returns null only for occurrences owned by another native coordinator. The responder must be
 * able to answer the evidence (its roller's controller or the GM); the root keeps its initiator.
 */
export async function readNativeEncounterActionResponseAdmission(
  ctx: QueryCtx,
  response: ResolveRuleOccurrenceInputDto,
  run: Doc<'encounterRuns'>,
  userId: string
) {
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (query) => query.eq('id', response.occurrenceId))
    .unique()
  if (!occurrence) return null
  const rootReceipt = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('commandId', occurrence.rootCommandId)
    )
    .unique()
  const snapshot =
    occurrence.pendingSnapshotJson === null
      ? null
      : serverRuleExecutionPendingSnapshotDtoSchema.parse(
          JSON.parse(occurrence.pendingSnapshotJson)
        )
  if (
    !isNativeActionOccurrence({
      context: snapshot?.applicationContext ?? null,
      rootCommandType: rootReceipt?.commandType ?? null
    })
  )
    return null
  if (occurrence.encounterId !== run.id || occurrence.campaignId !== run.campaignId)
    throw new Error('The action occurrence scope is invalid.')
  const pending = occurrence.state === 'PENDING' ? readNativeActionPending(occurrence) : null
  let parsed = pending?.command
  if (!parsed) {
    if (rootReceipt?.commandType !== 'RESOLVE_ACTION')
      throw new Error('Stored Encounter action root mismatch.')
    const root = encounterExecuteInputSchema.parse({
      command: JSON.parse(rootReceipt.commandJson)
    }).command
    if (root.type !== 'RESOLVE_ACTION') throw new Error('Stored Encounter action root mismatch.')
    parsed = root
  }
  const initiator = pending?.context.initiatorUserId ?? rootReceipt!.actorUserId
  const { campaign, membership } = await requireCampaignAuthority(ctx, run.campaignId, userId)
  if (
    pending &&
    !(await canAnswerNativeActionEvidence(ctx, { run, campaign, membership, occurrence }))
  )
    rejectDomain('NOT_ACTOR_CONTROLLER')
  const fingerprint = checksumCanonicalJson(response)
  const receipt = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('commandId', response.commandId)
    )
    .unique()
  if (receipt) {
    const { _id, _creationTime, ...stored } = receipt
    encounterStoredRuleReceiptSchema.parse(stored)
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (
      metadata.transition !== 'ACTION_EVIDENCE' ||
      metadata.rootCommandId !== parsed.commandId ||
      metadata.rootCommandFingerprint !== checksumCanonicalJson(parsed) ||
      metadata.rootInitiatorUserId !== initiator ||
      metadata.expectedAggregateVersion !== response.expectedVersion ||
      metadata.expectedOccurrenceVersion !== response.expectedOccurrenceVersion ||
      !('requestId' in response.resolution) ||
      metadata.requestId !== response.resolution.requestId ||
      metadata.resolutionKind !== response.resolution.kind ||
      receipt.campaignId !== run.campaignId ||
      receipt.encounterId !== run.id ||
      receipt.occurrenceId !== occurrence.id ||
      receipt.commandType !== response.type ||
      receipt.commandFingerprint !== fingerprint ||
      receipt.actorUserId !== userId ||
      receipt.correlationId !== (response.correlationId ?? null) ||
      receipt.resultChecksum !== checksumRuleDocument(payload) ||
      payload.occurrenceId !== occurrence.id ||
      payload.occurrenceVersion !== response.expectedOccurrenceVersion + 1 ||
      payload.occurrenceVersion > occurrence.version ||
      (payload.status !== 'PAUSED' && payload.status !== 'COMPLETE') ||
      receipt.encounterVersion !==
        response.expectedVersion + (payload.status === 'COMPLETE' ? 1 : 0)
    )
      throw new Error('Stored Encounter action evidence receipt mismatch.')
    const admission = await readNativeEncounterActionAdmission(ctx, parsed, userId, {
      occurrence,
      initiatorUserId: initiator
    })
    if (pending) {
      if (admission.kind !== 'READY')
        throw new Error('Stored Encounter action evidence receipt mismatch.')
      return {
        kind: 'REPLAY' as const,
        admission,
        result: nativeActionPendingResult(run, occurrence)
      }
    }
    if (admission.kind !== 'REPLAY')
      throw new Error('Stored Encounter action evidence receipt mismatch.')
    return { kind: 'REPLAY' as const, admission, result: admission.result }
  }
  if (
    !pending ||
    occurrence.version !== response.expectedOccurrenceVersion ||
    run.version !== response.expectedVersion ||
    occurrence.expectedEncounterVersion !== run.version
  )
    rejectDomain('VERSION_STALE', 'The action occurrence version is stale.')
  if (response.commandId === parsed.commandId || rootReceipt) rejectDomain('COMMAND_ID_REUSED')
  const used = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('commandId', response.commandId)
    )
    .unique()
  if (used) rejectDomain('COMMAND_ID_REUSED')
  const root = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('rootCommandId', response.commandId)
    )
    .unique()
  if (root) rejectDomain('COMMAND_ID_REUSED')
  const appRoll = await readEncounterSettledAppRoll(ctx, { occurrence, response, userId })
  const resolution = withEncounterAppRoll(response.resolution, appRoll)
  if (
    resolution.kind !== 'ENTER_DICE' &&
    resolution.kind !== 'ENTER_INTEGER' &&
    resolution.kind !== 'SYSTEM_ROLL'
  )
    throw new Error('The action requires dice or integer evidence.')
  const admission = await readNativeEncounterActionAdmission(ctx, parsed, userId, {
    occurrence,
    initiatorUserId: initiator
  })
  if (admission.kind !== 'READY')
    rejectDomain('VERSION_STALE', 'The action occurrence is no longer pending.')
  return { kind: 'READY' as const, admission, occurrence, pending, resolution, appRoll }
}
