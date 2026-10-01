import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type { z } from 'zod'
import { resolveRuleOccurrenceInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectEncounterSpatialOccurrenceSummary } from '@artificer-toolkit/rules-runtime/encounterSpatialOccurrenceSummary'
import type { EncounterReadTransaction } from './ports.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readPendingSnapshot } from './pendingSnapshots.js'

/** The published response's current-role result; never the private preparation. */
export async function readMovementResponseResult(
  ctx: EncounterReadTransaction,
  args: z.input<typeof resolveRuleOccurrenceInputDtoSchema>
): Promise<EncounterCommandResultDto> {
  const command = resolveRuleOccurrenceInputDtoSchema.parse(args)
  const { userId } = await ctx.ports.requireIdentity()
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', command.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  const receiptHeader = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_commandId', (q) =>
      q.eq('encounterId', run.id).eq('commandId', command.commandId)
    )
    .unique()
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', command.occurrenceId))
    .unique()
  if (
    !receiptHeader ||
    !occurrence ||
    receiptHeader.actorUserId !== userId ||
    receiptHeader.campaignId !== campaign.id ||
    receiptHeader.occurrenceId !== occurrence.id ||
    occurrence.campaignId !== campaign.id ||
    occurrence.encounterId !== run.id ||
    receiptHeader.commandType !== command.type ||
    receiptHeader.commandFingerprint !== checksumCanonicalJson(command)
  )
    throw new Error('Movement response receipt is inconsistent.')
  const receipt = receiptHeader
  if (
    receipt.resultChecksum !==
    checksumCanonicalJson(storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson)))
  )
    throw new Error('Movement response receipt is inconsistent.')

  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result: encounterCommandResultDtoSchema.parse({
      projection: await readEncounterGmProjection(ctx, readRunState(run)),
      roll: null,
      occurrence: projectEncounterSpatialOccurrenceSummary(
        {
          id: occurrence.id,
          version: occurrence.version,
          state: occurrence.state,
          pendingSnapshot: await readPendingSnapshot(ctx, occurrence)
        },
        run.version,
        { controlledActorIds: new Set(readRunState(run).actorIds) }
      )
    })
  })
}
