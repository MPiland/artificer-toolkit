import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { createDnd5eOptionalCombatContestGraph } from '@artificer-toolkit/rules-runtime/systems/dnd5e/optionalCombatContestGraph'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { presentTimelineEntry } from './timelineEntries'

/** Validates the original action and its terminal rule receipt without reevaluating changed facts. */
export async function readNativeDisarmReplay(
  ctx: MutationCtx,
  input: {
    run: Doc<'encounterRuns'>
    command: ResolveEncounterActionInputDto
    receipt: Doc<'encounterRunCommands'>
  }
) {
  const { run, command, receipt } = input
  presentTimelineEntry(receipt)
  if (
    receipt.commandType !== 'RESOLVE_ACTION' ||
    receipt.encounterId !== run.id ||
    receipt.campaignId !== run.campaignId ||
    receipt.commandFingerprint !== checksumCanonicalJson(command) ||
    receipt.commandId !== command.commandId ||
    receipt.version !== command.expectedVersion + 1 ||
    receipt.version > run.version
  )
    throw new Error('Stored Disarm command receipt mismatch.')
  const result = encounterCommandResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', receipt.ruleOccurrenceId))
    .unique()
  const ruleReceipt = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_commandId', (q) =>
      q.eq('encounterId', run.id).eq('commandId', command.commandId)
    )
    .unique()
  if (!occurrence || !ruleReceipt) throw new Error('Stored Disarm rule receipt is missing.')
  const { _id: _occurrenceId, _creationTime: _occurrenceTime, ...storedOccurrence } = occurrence
  const { _id: _receiptId, _creationTime: _receiptTime, ...storedReceipt } = ruleReceipt
  encounterStoredRuleOccurrenceSchema.parse(storedOccurrence)
  encounterStoredRuleReceiptSchema.parse(storedReceipt)
  const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(ruleReceipt.resultJson))
  const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
    JSON.parse(ruleReceipt.commandMetadataJson)
  )
  if (
    payload.status !== 'COMPLETE' ||
    payload.applicationOutputs.kind !== 'CONTESTED_ACTION' ||
    metadata.transition !== 'START'
  )
    throw new Error('Stored Disarm rule receipt mismatch.')
  const application = payload.applicationOutputs
  const graph = createDnd5eOptionalCombatContestGraph(application.policy)
  if (
    occurrence.state !== 'COMPLETED' ||
    occurrence.encounterId !== run.id ||
    occurrence.campaignId !== run.campaignId ||
    occurrence.rootCommandId !== command.commandId ||
    occurrence.expectedEncounterVersion !== receipt.version ||
    ruleReceipt.encounterId !== run.id ||
    ruleReceipt.campaignId !== run.campaignId ||
    ruleReceipt.occurrenceId !== occurrence.id ||
    ruleReceipt.commandId !== command.commandId ||
    ruleReceipt.commandType !== 'RESOLVE_ACTION' ||
    ruleReceipt.commandFingerprint !== receipt.commandFingerprint ||
    ruleReceipt.actorUserId !== receipt.actorUserId ||
    ruleReceipt.correlationId !== null ||
    ruleReceipt.encounterVersion !== receipt.version ||
    ruleReceipt.resultChecksum !== checksumRuleDocument(payload) ||
    ruleReceipt.resultChecksum !== receipt.ruleResultChecksum ||
    payload.occurrenceId !== occurrence.id ||
    payload.occurrenceVersion !== occurrence.version ||
    application.occurrenceId !== occurrence.id ||
    application.sourceActorId !== command.actorId ||
    application.targetActorId !== command.targetActorId ||
    application.policy.definitionId !== command.optionalCombatIntent?.definitionId ||
    application.contestGraph.definitionId !== graph.published.id ||
    application.contestGraph.checksum !== graph.published.checksum ||
    application.contestGraph.identityChecksum !== graph.identityChecksum ||
    payload.evidence.source.definitionId !== graph.published.id ||
    payload.evidence.source.checksum !== graph.published.checksum ||
    payload.outputs.initiatorNaturalD20 !== application.sourceRoll.selectedNatural ||
    payload.outputs.targetNaturalD20 !== application.targetRoll.selectedNatural ||
    payload.outputs.initiatorTotal !== application.sourceRoll.total ||
    payload.outputs.targetTotal !== application.targetRoll.total ||
    metadata.definitionId !== graph.published.id ||
    metadata.expectedAggregateVersion !== command.expectedVersion ||
    metadata.factsChecksum !== checksumRuleDocument(payload.evidence.facts) ||
    metadata.optionalCombatSnapshotChecksum !== receipt.optionalCombatSnapshotChecksum ||
    result.projection.id !== run.id ||
    result.projection.campaignId !== run.campaignId ||
    result.projection.version !== receipt.version ||
    result.occurrence?.occurrenceId !== occurrence.id ||
    result.occurrence.occurrenceVersion !== occurrence.version ||
    result.occurrence.status !== 'COMPLETE' ||
    result.occurrence.pending !== null ||
    result.occurrence.outcome !== null ||
    result.roll !== null ||
    result.resolution !== null
  )
    throw new Error('Stored Disarm rule receipt mismatch.')
  const target = result.projection.actors.find((actor) => actor.id === command.targetActorId)
  if (
    application.stateTransition.kind === 'CHARACTER_ITEM_USE_STATE' &&
    (target?.kind !== 'CHARACTER' ||
      target.sourceId !== application.stateTransition.characterId ||
      target.sourceRevision !== application.stateTransition.afterStreamVersion)
  )
    throw new Error('Stored Disarm Character transition mismatch.')
  return { result, payload, occurrence }
}

/** Evidence command IDs replay their original authorized response, including an earlier pause. */
export function readNativeDisarmEvidenceReplay(input: {
  receipt: Doc<'encounterRuleReceipts'>
  occurrence: Doc<'encounterRuleOccurrences'>
  response: ResolveRuleOccurrenceInputDto
  rootCommand: ResolveEncounterActionInputDto
  initiatorUserId: string
  userId: string
}) {
  const { receipt, response, occurrence } = input
  const { _id, _creationTime, ...stored } = receipt
  encounterStoredRuleReceiptSchema.parse(stored)
  const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
    JSON.parse(receipt.commandMetadataJson)
  )
  const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (
    metadata.transition !== 'ACTION_EVIDENCE' ||
    !metadata.commandResult ||
    (payload.status !== 'PAUSED' && payload.status !== 'COMPLETE')
  )
    throw new Error('Stored Disarm evidence receipt mismatch.')
  const result = encounterCommandResultDtoSchema.parse(
    JSON.parse(metadata.commandResult.resultJson)
  )
  if (
    metadata.rootCommandId !== input.rootCommand.commandId ||
    metadata.rootCommandFingerprint !== checksumCanonicalJson(input.rootCommand) ||
    metadata.rootInitiatorUserId !== input.initiatorUserId ||
    metadata.expectedAggregateVersion !== response.expectedVersion ||
    metadata.expectedOccurrenceVersion !== response.expectedOccurrenceVersion ||
    !('requestId' in response.resolution) ||
    metadata.requestId !== response.resolution.requestId ||
    metadata.resolutionKind !== response.resolution.kind ||
    receipt.commandFingerprint !== checksumCanonicalJson(response) ||
    receipt.actorUserId !== input.userId ||
    receipt.commandType !== response.type ||
    receipt.commandId !== response.commandId ||
    receipt.encounterId !== occurrence.encounterId ||
    receipt.campaignId !== occurrence.campaignId ||
    receipt.occurrenceId !== occurrence.id ||
    receipt.correlationId !== (response.correlationId ?? null) ||
    receipt.resultChecksum !== checksumRuleDocument(payload) ||
    payload.occurrenceId !== occurrence.id ||
    payload.occurrenceVersion !== response.expectedOccurrenceVersion + 1 ||
    payload.occurrenceVersion > occurrence.version ||
    receipt.encounterVersion !==
      response.expectedVersion + (payload.status === 'COMPLETE' ? 1 : 0) ||
    result.projection.id !== occurrence.encounterId ||
    result.projection.campaignId !== occurrence.campaignId ||
    result.projection.version !== receipt.encounterVersion ||
    result.occurrence?.occurrenceId !== occurrence.id ||
    result.occurrence.occurrenceVersion !== payload.occurrenceVersion ||
    result.occurrence.status !== (payload.status === 'COMPLETE' ? 'COMPLETE' : 'PENDING') ||
    result.occurrence.outcome !== null ||
    result.roll !== null ||
    result.resolution !== null ||
    checksumCanonicalJson(result) !== metadata.commandResult.resultChecksum
  )
    throw new Error('Stored Disarm evidence receipt mismatch.')
  if (
    payload.status === 'COMPLETE'
      ? result.occurrence.pending !== null
      : result.occurrence.pending !== null &&
        (result.occurrence.pending.kind !== 'D20_EVIDENCE' ||
          result.occurrence.pending.request.requestId !== payload.request.requestId ||
          payload.pending?.kind !== 'D20_EVIDENCE' ||
          result.occurrence.pending.request.rollMode !== payload.pending.rollMode)
  )
    throw new Error('Stored Disarm evidence response mismatch.')
  return { result, payload }
}
