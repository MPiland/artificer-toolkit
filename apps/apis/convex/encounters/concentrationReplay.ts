import { characterMechanicsApplicationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { QueryCtx } from '../_generated/server'
import {
  concentrationCommandId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
/** Automatic child cleanup can advance Character revisions after the immutable parent damage receipt. */
export async function readNativeConcentrationCleanupRevisions(
  ctx: QueryCtx,
  input: {
    campaignId: string
    encounterId: string
    encounterVersion: number
    parentOccurrenceId: string
    targetActorId: string
    userId: string
    applications: readonly ReturnType<typeof characterMechanicsApplicationDtoSchema.parse>[]
  }
) {
  const revisions = new Map<string, { before: number; after: number }>()
  let correlationId = input.parentOccurrenceId
  for (const application of input.applications) {
    if (application.kind !== 'DAMAGE' || application.appliedAmount <= 0) continue
    const damage = {
      ordinal: application.ordinal,
      sourceNodeId: application.sourceNodeId,
      sourceOperationKey: application.sourceOperationKey,
      targetActorId: input.targetActorId,
      appliedAmount: application.appliedAmount,
      damageTypeId: application.damageTypeId
    }
    const childId = concentrationOccurrenceId(input.parentOccurrenceId, damage)
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', input.campaignId).eq('commandId', concentrationCommandId(childId))
      )
      .unique()
    // Assisted checks have their own response command and never alter the parent's stored projection.
    if (!receipt) break
    const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', childId))
      .unique()
    if (
      result.status !== 'COMPLETE' ||
      result.applicationOutputs.kind !== 'CONCENTRATION_CHECK' ||
      receipt.commandType !== 'CONCENTRATION_CHECK' ||
      receipt.encounterId !== input.encounterId ||
      receipt.encounterVersion !== input.encounterVersion ||
      receipt.occurrenceId !== childId ||
      receipt.actorUserId !== input.userId ||
      receipt.correlationId !== correlationId ||
      result.occurrenceId !== childId ||
      result.occurrenceVersion !== 1 ||
      result.applicationOutputs.parentOccurrenceId !== input.parentOccurrenceId ||
      checksumRuleDocument(result) !== receipt.resultChecksum ||
      metadata.transition !== 'START' ||
      metadata.expectedAggregateVersion !== input.encounterVersion ||
      metadata.definitionId !== result.evidence.source.definitionId ||
      metadata.factsChecksum !== result.initialFactsChecksum ||
      !occurrence ||
      occurrence.encounterId !== input.encounterId ||
      occurrence.campaignId !== input.campaignId ||
      occurrence.state !== 'COMPLETED' ||
      occurrence.expectedEncounterVersion !== input.encounterVersion ||
      occurrence.version !== result.occurrenceVersion ||
      occurrence.rootCommandId !== receipt.commandId
    )
      throw new Error('Stored concentration child receipt mismatch.')
    const { maintainedStateId: _stateId, ...retainedDamage } = result.applicationOutputs.application
    if (
      checksumRuleDocument(retainedDamage) !== checksumRuleDocument(damage) ||
      receipt.commandFingerprint !==
        checksumRuleDocument({
          parentOccurrenceId: input.parentOccurrenceId,
          application: damage,
          contextChecksum: result.applicationOutputs.contextChecksum
        })
    )
      throw new Error('Stored concentration damage receipt mismatch.')
    for (const transition of result.applicationOutputs.cleanup?.characterOwnerTransitions ?? []) {
      if (revisions.has(transition.characterId))
        throw new Error('Stored concentration owner revision is duplicated.')
      revisions.set(transition.characterId, {
        before: transition.beforeStreamVersion,
        after: transition.afterStreamVersion
      })
    }
    if (result.applicationOutputs.outcome === 'SAVE_FAILURE') break
    correlationId = childId
  }
  return revisions
}
