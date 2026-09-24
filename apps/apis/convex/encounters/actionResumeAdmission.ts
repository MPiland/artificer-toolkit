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
import { nativeActionPendingResult, readNativeActionPending } from './actionPending'

/** Returns null only for occurrences owned by another native coordinator. */
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
    rootReceipt?.commandType !== 'RESOLVE_ACTION' &&
    snapshot?.applicationContext.kind !== 'ENCOUNTER_ACTION'
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
  if (initiator !== userId) throw new Error('The pending action initiator changed.')
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
    const admission = await readNativeEncounterActionAdmission(ctx, parsed, userId, { occurrence })
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
    throw new Error('The action occurrence version is stale.')
  if (response.commandId === parsed.commandId || rootReceipt)
    throw new Error('Command ID was already used with different input.')
  const used = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('commandId', response.commandId)
    )
    .unique()
  if (used) throw new Error('Command ID was already used with different input.')
  const root = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (query) =>
      query.eq('campaignId', run.campaignId).eq('rootCommandId', response.commandId)
    )
    .unique()
  if (root) throw new Error('Command ID was already used with different input.')
  const resolution = response.resolution
  if (
    resolution.kind !== 'ENTER_DICE' &&
    resolution.kind !== 'ENTER_INTEGER' &&
    resolution.kind !== 'SYSTEM_ROLL'
  )
    throw new Error('The action requires dice or integer evidence.')
  const admission = await readNativeEncounterActionAdmission(ctx, parsed, userId, { occurrence })
  if (admission.kind !== 'READY') throw new Error('The action occurrence is no longer pending.')
  return { kind: 'READY' as const, admission, occurrence, pending, resolution }
}
