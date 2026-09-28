import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  getPendingEncounterRuleOccurrenceInputDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounterData'
import { readValidatedRunProjection } from '@artificer-toolkit/encounter-persistence/documents'
import { readPendingRunDecision } from '@artificer-toolkit/encounter-persistence/pendingReads'
import { internalQuery, query, type QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { encounterReadTransaction } from './encounterPorts'

const pendingRuleOccurrenceDefinition = {
  args: zodToConvexFields(getPendingEncounterRuleOccurrenceInputDtoSchema.shape),
  get returns(): Validator<PendingEncounterRuleOccurrenceSummaryDto | null, 'required', string> {
    return zodToConvex<z.core.$ZodType<PendingEncounterRuleOccurrenceSummaryDto | null>>(
      zMini.nullable(pendingEncounterRuleOccurrenceSummaryDtoSchema)
    )
  },
  handler: async (
    ctx: QueryCtx,
    args: z.infer<typeof getPendingEncounterRuleOccurrenceInputDtoSchema>
  ): Promise<PendingEncounterRuleOccurrenceSummaryDto | null> => {
    const input = getPendingEncounterRuleOccurrenceInputDtoSchema.parse({
      encounterId: args.encounterId.toLowerCase()
    })
    const { userId } = await requireIdentity(ctx)
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
      .unique()
    if (!row) throw new Error('Encounter is unavailable.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, row.campaignId, userId)
    readValidatedRunProjection(row, campaign)
    return zMini
      .nullable(pendingEncounterRuleOccurrenceSummaryDtoSchema)
      .parse(await readPendingRunDecision(encounterReadTransaction(ctx), row, campaign, membership))
  }
}

export const pendingRuleOccurrence = query(pendingRuleOccurrenceDefinition)
export const forPrepared = internalQuery(pendingRuleOccurrenceDefinition)
