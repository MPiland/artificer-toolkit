import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import * as zMini from 'zod/mini'
import {
  encounterEvidenceRollDtoSchema,
  getEncounterInputDtoSchema,
  type EncounterEvidenceRollDto
} from '@artificer-toolkit/schema/api/encounterData'
import { readLatestEvidenceRolls } from '@artificer-toolkit/encounter-persistence/evidenceRolls'
import { query } from '../lib/queries'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { encounterReadTransaction } from './encounterPorts'

const latestRollsValidator: Validator<EncounterEvidenceRollDto[], 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterEvidenceRollDto[]>
>(zMini.array(encounterEvidenceRollDtoSchema))

/** The caller's latest app roll for each request of their current pending decision. */
export const latest = query({
  args: zodToConvexFields(getEncounterInputDtoSchema.shape),
  returns: latestRollsValidator,
  handler: async (ctx, args): Promise<EncounterEvidenceRollDto[]> => {
    const { userId } = await requireIdentity(ctx)
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', args.encounterId.toLowerCase()))
      .unique()
    if (!run) throw new Error('Encounter is unavailable.')
    const authority = await requireCampaignAuthority(ctx, run.campaignId, userId)
    return readLatestEvidenceRolls(encounterReadTransaction(ctx), { run, ...authority })
  }
})
