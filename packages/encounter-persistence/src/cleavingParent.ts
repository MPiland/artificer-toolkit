import { actionTargetActorId } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { encounterExecuteInputSchema } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRuleReceiptSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  storedRuleExecutionResultDtoSchema,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumRuleDocument, RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'
import { cleavingChildOccurrenceIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import {
  retainedCleavingDamage,
  cleavingDamageEnvelope,
  type CleavingContext
} from '@artificer-toolkit/rules-runtime/encounterCleavingFacts'
import { presentTimelineEntry } from './timelineEntries.js'
import type { EncounterReadContext } from './store.js'

async function terminalReceipt(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  occurrenceId: string,
  checksum?: string
) {
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
    .unique()
  if (
    !occurrence ||
    occurrence.state !== 'COMPLETED' ||
    occurrence.encounterId !== state.id ||
    occurrence.campaignId !== state.campaignId
  )
    throw new Error('Cleaving parent action is stale.')
  const rows = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_occurrenceId', (q) => q.eq('occurrenceId', occurrenceId))
    .take(RULE_GRAPH_LIMITS.NODES * 20 + 1)
  if (rows.length > RULE_GRAPH_LIMITS.NODES * 20)
    throw new Error('Cleaving parent receipts exceed their bound.')
  const terminal = rows.flatMap((row) => {
    const { _id, _creationTime, ...stored } = row
    encounterStoredRuleReceiptSchema.parse(stored)
    const payload = storedRuleExecutionResultDtoSchema.parse(JSON.parse(row.resultJson))
    if (
      row.encounterId !== state.id ||
      row.campaignId !== state.campaignId ||
      payload.occurrenceId !== occurrenceId ||
      checksumRuleDocument(payload) !== row.resultChecksum
    )
      throw new Error('Cleaving parent receipt mismatch.')
    return (payload.status === 'COMPLETE' || payload.status === 'AGGREGATE_CHOICE_COMPLETE') &&
      payload.occurrenceVersion === occurrence.version &&
      row.encounterVersion === occurrence.expectedEncounterVersion
      ? [{ row, payload }]
      : []
  })
  if (
    !terminal.length ||
    new Set(terminal.map(({ row }) => row.resultChecksum)).size !== 1 ||
    (checksum !== undefined && terminal[0]!.row.resultChecksum !== checksum)
  )
    throw new Error('Cleaving parent action is stale.')
  return { ...terminal[0]!, occurrence }
}

/** Walks the bounded receipt chain back to the original finalized attack, and returns its occurrence. */
export async function verifyNativeCleavingParentChain(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  context: CleavingContext
) {
  const chain: Extract<StoredRuleExecutionResultDto, { status: 'AGGREGATE_CHOICE_COMPLETE' }>[] = []
  let parent = await terminalReceipt(
    ctx,
    state,
    context.parentOccurrenceId,
    context.parentResultChecksum
  )
  const seen = new Set<string>()
  while (parent.payload.status === 'AGGREGATE_CHOICE_COMPLETE') {
    const payload = parent.payload
    if (
      chain.length >= RULE_GRAPH_LIMITS.NODES - 1 ||
      seen.has(payload.occurrenceId) ||
      payload.applicationOutputs.kind !== 'CLEAVING_DAMAGE' ||
      payload.applicationOutputs.outcome !== 'APPLIED' ||
      payload.applicationOutputs.sourceActorId !== context.sourceActorId
    )
      throw new Error('Cleaving parent chain is invalid.')
    seen.add(payload.occurrenceId)
    chain.unshift(payload)
    parent = await terminalReceipt(ctx, state, payload.applicationOutputs.parentOccurrenceId)
  }
  if (parent.payload.status !== 'COMPLETE') throw new Error('Cleaving parent action is stale.')
  const retained = retainedCleavingDamage(parent.payload)
  const root = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', state.campaignId).eq('commandId', parent.occurrence.rootCommandId)
    )
    .unique()
  if (!root || root.commandType !== 'RESOLVE_ACTION')
    throw new Error('Cleaving parent action is stale.')
  presentTimelineEntry(root)
  const command = encounterExecuteInputSchema.parse({
    command: JSON.parse(root.commandJson)
  }).command
  if (
    !retained ||
    command.type !== 'RESOLVE_ACTION' ||
    command.actorId !== context.sourceActorId ||
    command.actionId !== context.action.actionId ||
    root.root.kind !== 'RULE_OCCURRENCE' ||
    root.root.ruleOccurrenceId !== parent.occurrence.id ||
    root.root.ruleResultChecksum !== checksumRuleDocument(parent.payload) ||
    actionTargetActorId(command.target) !== retained.initialTargetActorId ||
    context.initialTargetActorId !== retained.initialTargetActorId ||
    checksumRuleDocument(context.originalAttack) !==
      checksumRuleDocument(retained.originalAttack) ||
    context.action.publishedDefinitionId !== parent.payload.evidence.source.definitionId ||
    context.action.publishedDefinitionChecksum !== parent.payload.evidence.source.checksum ||
    command.sceneContext?.sceneId !== context.scene.sceneId ||
    command.sceneContext.expectedSceneVersion !== context.scene.sceneVersion ||
    command.sceneContext.sourceTokenId !== context.scene.sourceTokenId
  )
    throw new Error('Cleaving retained action facts are stale.')
  let damage = retained.damage
  const visited = [retained.initialTargetActorId]
  let parentId = parent.payload.occurrenceId
  for (const [index, step] of chain.entries()) {
    const output = step.applicationOutputs
    if (
      output.kind !== 'CLEAVING_DAMAGE' ||
      output.targetActorId === null ||
      output.targetTransition === null ||
      output.parentOccurrenceId !== parentId ||
      step.occurrenceId !== cleavingChildOccurrenceIdentity(parentId, index + 1) ||
      visited.includes(output.targetActorId) ||
      output.damage.requestedAmount !== damage.remainingAmount ||
      output.damage.sourceNodeId !== damage.sourceNodeId ||
      output.damage.sourceOperationKey !== damage.sourceOperationKey ||
      output.damage.damageTypeId !== damage.damageTypeId ||
      output.targetTransition.before.currentHitPoints !==
        output.targetTransition.before.maximumHitPoints ||
      output.targetTransition.after.currentHitPoints !== 0
    )
      throw new Error('Cleaving retained damage chain is invalid.')
    const transition = output.targetTransition
    damage = cleavingDamageEnvelope({
      ...output.damage,
      targetActorId: output.targetActorId,
      beforeCurrentHitPoints: transition.before.currentHitPoints,
      afterCurrentHitPoints: transition.after.currentHitPoints,
      beforeTemporaryHitPoints: transition.before.temporaryHitPoints,
      afterTemporaryHitPoints: transition.after.temporaryHitPoints,
      maximumHitPoints: transition.before.maximumHitPoints,
      damageDisposition: 'NORMAL'
    })
    visited.push(output.targetActorId)
    parentId = step.occurrenceId
  }
  if (
    context.chainStep !== visited.length ||
    checksumRuleDocument(context.visitedTargetActorIds) !== checksumRuleDocument(visited) ||
    checksumRuleDocument(context.damage) !== checksumRuleDocument(damage)
  )
    throw new Error('Cleaving retained damage is stale.')
  return parent.occurrence.id
}
