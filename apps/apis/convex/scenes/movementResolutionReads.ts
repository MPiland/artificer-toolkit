import type { Validator } from 'convex/values'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type { z } from 'zod'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { resolveRuleOccurrenceInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectEncounterSpatialOccurrenceSummary } from '@artificer-toolkit/rules-runtime/encounterSpatialOccurrenceSummary'
import { internalQuery } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { presentEncounterResultForMember } from '../encounters/resultPresentation'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readRunProjection, readRunState } from '../encounters/documents'

/** Return current-role projections after publication; never return the private preparation. */
export const result = internalQuery({
  args: zodToConvexFields(resolveRuleOccurrenceInputDtoSchema.shape),
  get returns(): Validator<EncounterCommandResultDto, 'required', string> {
    return zodToConvex<z.core.$ZodType<EncounterCommandResultDto>>(encounterCommandResultDtoSchema)
  },
  handler: async (ctx, args) => {
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
    const pendingSnapshot = occurrence.pendingSnapshotJson
      ? serverRuleExecutionPendingSnapshotDtoSchema.parse(
          JSON.parse(occurrence.pendingSnapshotJson)
        )
      : null
    if (
      (pendingSnapshot ? checksumCanonicalJson(pendingSnapshot) : null) !==
      occurrence.pendingSnapshotChecksum
    )
      throw new Error('Movement response occurrence checksum is inconsistent.')
    return presentEncounterResultForMember(ctx, {
      campaign,
      membership,
      result: encounterCommandResultDtoSchema.parse({
        projection: readRunProjection(run),
        roll: null,
        occurrence: projectEncounterSpatialOccurrenceSummary(
          {
            id: occurrence.id,
            version: occurrence.version,
            state: occurrence.state,
            pendingSnapshot
          },
          run.version,
          { controlledActorIds: new Set(readRunState(run).actorIds) }
        )
      })
    })
  }
})
