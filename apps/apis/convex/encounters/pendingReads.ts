import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  getPendingEncounterRuleOccurrenceInputDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounterData'
import { readCampaignRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readPendingRunDecision } from '@artificer-toolkit/encounter-persistence/pendingReads'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { encounterReadTransaction } from './encounterReadPorts'
import { readMemberEncounter } from './readAccess'

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
    const { run, campaign, membership } = await readMemberEncounter(ctx, input.encounterId)
    readCampaignRunState(run, campaign)
    return zMini
      .nullable(pendingEncounterRuleOccurrenceSummaryDtoSchema)
      .parse(await readPendingRunDecision(encounterReadTransaction(ctx), run, campaign, membership))
  }
}

export const pendingRuleOccurrence = query(pendingRuleOccurrenceDefinition)
