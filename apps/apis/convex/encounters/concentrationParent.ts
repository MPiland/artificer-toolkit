import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_CONCENTRATION_DAMAGE_APPLICATIONS } from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumRuleDocument, RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'
import type { QueryCtx } from '../_generated/server'
import { concentrationOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import type { NativeConcentrationContext } from '@artificer-toolkit/rules-runtime/encounterConcentration'
import { nativeConcentrationParentDamage } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { presentTimelineEntry } from './timelineEntries'

/** A failed sibling may advance the Run; every intervening command must belong to this damage parent. */
export async function readNativeConcentrationParentDamage(
  ctx: QueryCtx,
  input: { state: EncounterRunState; context: NativeConcentrationContext }
) {
  const { state, context } = input
  const parent = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', context.parentOccurrenceId))
    .unique()
  const parentReceipts = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_occurrenceId', (q) => q.eq('occurrenceId', context.parentOccurrenceId))
    .take(RULE_GRAPH_LIMITS.NODES * 20 + 1)
  if (
    !parent ||
    parent.encounterId !== state.id ||
    parent.campaignId !== state.campaignId ||
    parent.state !== 'COMPLETED' ||
    parent.expectedEncounterVersion > state.version ||
    parentReceipts.length > RULE_GRAPH_LIMITS.NODES * 20
  )
    throw new Error('The concentration parent is unavailable.')
  const matching = parentReceipts.filter(
    (receipt) =>
      receipt.commandFingerprint === context.parentCommandFingerprint &&
      receipt.encounterVersion === parent.expectedEncounterVersion
  )
  if (matching.length !== 1) throw new Error('The concentration parent receipt is unavailable.')
  const receipt = matching[0]!
  const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (
    receipt.encounterId !== state.id ||
    receipt.campaignId !== state.campaignId ||
    result.occurrenceId !== parent.id ||
    result.occurrenceVersion !== parent.version ||
    checksumRuleDocument(result) !== receipt.resultChecksum
  )
    throw new Error('The concentration parent receipt is invalid.')
  const applications = nativeConcentrationParentDamage(result)

  if (parent.expectedEncounterVersion < state.version) {
    const commands = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId_version', (q) =>
        q
          .eq('encounterId', state.id)
          .gt('version', parent.expectedEncounterVersion)
          .lte('version', state.version)
      )
      .take(MAX_CONCENTRATION_DAMAGE_APPLICATIONS + 1)
    if (commands.length > MAX_CONCENTRATION_DAMAGE_APPLICATIONS)
      throw new Error('The concentration continuation exceeds its command bound.')
    const advances = new Set<number>()
    const applicationChecksums = new Set(
      applications.map((application) => checksumRuleDocument(application))
    )
    for (const command of commands) {
      presentTimelineEntry(command)
      const child = await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', state.campaignId).eq('commandId', command.commandId)
        )
        .unique()
      if (!child || command.commandType !== 'RESOLVE_RULE_OCCURRENCE')
        throw new Error('The concentration parent version is stale.')
      const childResult = storedRuleExecutionResultDtoSchema.parse(JSON.parse(child.resultJson))
      const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
        JSON.parse(child.commandMetadataJson)
      )
      if (
        childResult.status !== 'COMPLETE' ||
        childResult.applicationOutputs.kind !== 'CONCENTRATION_CHECK' ||
        childResult.applicationOutputs.parentOccurrenceId !== parent.id ||
        childResult.occurrenceId !==
          concentrationOccurrenceId(parent.id, childResult.applicationOutputs.application) ||
        child.encounterId !== state.id ||
        child.commandType !== command.commandType ||
        child.occurrenceId !== childResult.occurrenceId ||
        child.occurrenceId !== command.ruleOccurrenceId ||
        child.encounterVersion !== command.version ||
        child.actorUserId !== command.actorUserId ||
        child.commandFingerprint !== command.commandFingerprint ||
        checksumRuleDocument(childResult) !== child.resultChecksum ||
        child.resultChecksum !== command.ruleResultChecksum ||
        metadata.transition !== 'RESUME' ||
        metadata.expectedAggregateVersion +
          (childResult.applicationOutputs.outcome === 'SAVE_FAILURE' ? 1 : 0) !==
          command.version
      )
        throw new Error('The concentration parent version is stale.')
      const { maintainedStateId: _stateId, ...damage } = childResult.applicationOutputs.application
      if (
        !applicationChecksums.has(checksumRuleDocument(damage)) ||
        damage.ordinal >= context.application.ordinal
      )
        throw new Error('The concentration sibling does not match its parent damage.')
      if (childResult.applicationOutputs.outcome === 'SAVE_FAILURE') {
        if (advances.has(command.version))
          throw new Error('The concentration version advance is duplicated.')
        advances.add(command.version)
      }
    }
    if (advances.size !== state.version - parent.expectedEncounterVersion)
      throw new Error('The concentration parent version is stale.')
  }
  return applications
}
