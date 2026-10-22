import { actionTargetActorId } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { contestCheckCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import type { ContestRootCommand } from './contestAdmission.js'
import { readEncounterReplayReceipt } from './replayReceipts.js'
import { presentTimelineEntry } from './timelineEntries.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'

/** Validates the original action and its terminal rule receipt without reevaluating changed facts. */
export async function readNativeContestReplay(
  ctx: EncounterReadContext,
  input: {
    run: EncounterDocument<'encounterRuns'>
    command: ContestRootCommand
    receipt: EncounterDocument<'encounterRunCommands'>
  }
) {
  const { run, command, receipt } = input
  presentTimelineEntry(receipt)
  // An action records its contest as its root occurrence; an escape records it as its check.
  const rooted =
    receipt.commandType === 'RESOLVE_ACTION' && receipt.root.kind === 'RULE_OCCURRENCE'
      ? receipt.root
      : receipt.commandType === 'ESCAPE'
        ? {
            ruleOccurrenceId: receipt.receipt.checkOccurrenceId,
            ruleResultChecksum: null,
            optionalCombatSnapshotChecksum: null
          }
        : null
  if (
    !rooted ||
    receipt.commandType !== command.type ||
    receipt.encounterId !== run.id ||
    receipt.campaignId !== run.campaignId ||
    receipt.commandFingerprint !== checksumCanonicalJson(command) ||
    receipt.commandId !== command.commandId ||
    receipt.version !== command.expectedVersion + 1 ||
    receipt.version > run.version
  )
    throw new Error('Stored contest command receipt mismatch.')
  const { ruleOccurrenceId, ruleResultChecksum, optionalCombatSnapshotChecksum } = rooted
  const replayReceipt = readEncounterReplayReceipt(receipt)
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', ruleOccurrenceId))
    .unique()
  const ruleReceipt = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_commandId', (q) =>
      q.eq('encounterId', run.id).eq('commandId', command.commandId)
    )
    .unique()
  if (!occurrence || !ruleReceipt) throw new Error('Stored contest rule receipt is missing.')
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
    throw new Error('Stored contest rule receipt mismatch.')
  const application = payload.applicationOutputs
  const { policy } = application
  // An optional combat contest rebuilds its System graph from the pin; a basic action contest runs
  // its capability's own graph, which the stored receipts bind.
  const optionalCombat = policy
    ? contestCheckCapabilityRegistry.require(run.gameSystemId).optionalCombatContestGraph(policy)
    : null
  const graph = optionalCombat?.published ?? {
    id: application.contestGraph.definitionId,
    checksum: application.contestGraph.checksum
  }
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
    ruleReceipt.commandType !== command.type ||
    ruleReceipt.commandFingerprint !== receipt.commandFingerprint ||
    ruleReceipt.actorUserId !== receipt.actorUserId ||
    ruleReceipt.correlationId !== null ||
    ruleReceipt.encounterVersion !== receipt.version ||
    ruleReceipt.resultChecksum !== checksumRuleDocument(payload) ||
    (ruleResultChecksum !== null && ruleReceipt.resultChecksum !== ruleResultChecksum) ||
    payload.occurrenceId !== occurrence.id ||
    payload.occurrenceVersion !== occurrence.version ||
    application.occurrenceId !== occurrence.id ||
    application.sourceActorId !== command.actorId ||
    (command.type === 'ESCAPE'
      ? policy !== null ||
        (receipt.commandType === 'ESCAPE' &&
          (receipt.receipt.actorId !== command.actorId ||
            checksumCanonicalJson(receipt.receipt.actionEconomy) !==
              checksumCanonicalJson(application.actionEconomyTransition)))
      : application.targetActorId !== actionTargetActorId(command.target) ||
        (policy?.definitionId ?? null) !== (command.optionalCombatIntent?.definitionId ?? null)) ||
    application.contestGraph.definitionId !== graph.id ||
    application.contestGraph.checksum !== graph.checksum ||
    (optionalCombat &&
      application.contestGraph.identityChecksum !== optionalCombat.identityChecksum) ||
    payload.evidence.source.definitionId !== graph.id ||
    payload.evidence.source.checksum !== graph.checksum ||
    payload.outputs.initiatorNaturalD20 !== application.sourceRoll.selectedNatural ||
    payload.outputs.targetNaturalD20 !== application.targetRoll.selectedNatural ||
    payload.outputs.initiatorTotal !== application.sourceRoll.total ||
    payload.outputs.targetTotal !== application.targetRoll.total ||
    metadata.definitionId !== graph.id ||
    metadata.expectedAggregateVersion !== command.expectedVersion ||
    metadata.factsChecksum !== checksumRuleDocument(payload.evidence.facts) ||
    (optionalCombatSnapshotChecksum !== null &&
      metadata.optionalCombatSnapshotChecksum !== optionalCombatSnapshotChecksum) ||
    replayReceipt.occurrence?.occurrenceId !== occurrence.id ||
    replayReceipt.occurrence.occurrenceVersion !== occurrence.version ||
    replayReceipt.occurrence.status !== 'COMPLETE' ||
    replayReceipt.occurrence.pending !== null ||
    replayReceipt.roll !== null
  )
    throw new Error('Stored contest rule receipt mismatch.')
  return { payload, occurrence, receipt }
}

/** Evidence command IDs replay their original authorized response, including an earlier pause. */
export function readNativeContestEvidenceReplay(input: {
  receipt: EncounterDocument<'encounterRuleReceipts'>
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
  response: ResolveRuleOccurrenceInputDto
  rootCommand: ContestRootCommand
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
    !metadata.replayReceipt ||
    (payload.status !== 'PAUSED' && payload.status !== 'COMPLETE')
  )
    throw new Error('Stored contest evidence receipt mismatch.')
  const replayReceipt = readEncounterReplayReceipt(metadata.replayReceipt)
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
    replayReceipt.occurrence?.occurrenceId !== occurrence.id ||
    replayReceipt.occurrence.occurrenceVersion !== payload.occurrenceVersion ||
    replayReceipt.occurrence.status !== (payload.status === 'COMPLETE' ? 'COMPLETE' : 'PENDING') ||
    replayReceipt.roll !== null
  )
    throw new Error('Stored contest evidence receipt mismatch.')
  const pending = replayReceipt.occurrence.pending
  if (
    payload.status === 'COMPLETE'
      ? pending !== null
      : pending !== null &&
        // A defender who picks its check answers a CONTEST_CHECK prompt with no sealed roll mode.
        (pending.kind === 'CONTEST_CHECK'
          ? pending.requestId !== payload.request.requestId || payload.pending != null
          : // A won outcome's dice carry no roll mode (D173).
            pending.kind === 'ACTION_OUTCOME_EVIDENCE'
            ? pending.request.requestId !== payload.request.requestId || payload.pending != null
            : pending.kind !== 'D20_EVIDENCE' ||
              pending.request.requestId !== payload.request.requestId ||
              payload.pending?.kind !== 'D20_EVIDENCE' ||
              pending.request.rollMode !== payload.pending.rollMode)
  )
    throw new Error('Stored contest evidence response mismatch.')
  return { replayReceipt: metadata.replayReceipt, payload }
}
