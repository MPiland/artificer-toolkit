import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type { z } from 'zod'
import { resolveRuleOccurrenceInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectEncounterSpatialOccurrenceSummary } from '@artificer-toolkit/rules-runtime/encounterSpatialOccurrenceSummary'
import { type QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { presentEncounterResultForMember } from '@artificer-toolkit/encounter-persistence/resultPresentation'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { encounterReadTransaction } from '../encounters/encounterPorts'

/** The published response's current-role result; never the private preparation. */
export async function readMovementResponseResult(
  ctx: QueryCtx,
  args: z.input<typeof resolveRuleOccurrenceInputDtoSchema>
): Promise<EncounterCommandResultDto> {
  const command = resolveRuleOccurrenceInputDtoSchema.parse(args)
  const { userId } = await requireIdentity(ctx)
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', command.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await requireCampaignAuthority(ctx, run.campaignId, userId)
  const receipt = await ctx.db
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
    !receipt ||
    !occurrence ||
    receipt.actorUserId !== userId ||
    receipt.campaignId !== campaign.id ||
    receipt.occurrenceId !== occurrence.id ||
    occurrence.campaignId !== campaign.id ||
    occurrence.encounterId !== run.id ||
    receipt.commandType !== command.type ||
    receipt.commandFingerprint !== checksumCanonicalJson(command) ||
    receipt.resultChecksum !==
      checksumCanonicalJson(
        storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
      )
  )
    throw new Error('Movement response receipt is inconsistent.')

  return presentEncounterResultForMember(encounterReadTransaction(ctx), {
    campaign,
    membership,
    result: encounterCommandResultDtoSchema.parse({
      projection: await readEncounterGmProjection(encounterReadTransaction(ctx), readRunState(run)),
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
