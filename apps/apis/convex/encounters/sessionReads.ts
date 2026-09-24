import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterSessionStateDtoSchema,
  getSessionEncounterInputDtoSchema,
  type EncounterSessionStateDto
} from '@artificer-toolkit/schema/api/encounterData'
import { query } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { readPendingRunDecision } from './pendingReads'
import { presentRun, readActiveRun } from './projectionReads'

/** One authenticated snapshot keeps the tabletop's Run and pending decision in sync. */
export const active = query({
  args: zodToConvexFields(getSessionEncounterInputDtoSchema.shape),
  get returns(): Validator<EncounterSessionStateDto, 'required', string> {
    return zodToConvex<z.core.$ZodType<EncounterSessionStateDto>>(encounterSessionStateDtoSchema)
  },
  handler: async (ctx, args): Promise<EncounterSessionStateDto> => {
    const input = getSessionEncounterInputDtoSchema.parse({
      campaignId: args.campaignId.toLowerCase(),
      sessionId: args.sessionId.toLowerCase()
    })
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const row = await readActiveRun(ctx, campaign.id)
    if (!row || row.sessionId !== input.sessionId) return { encounter: null, pending: null }
    const encounter = await presentRun(ctx, row, campaign, membership.role)
    return encounterSessionStateDtoSchema.parse({
      encounter,
      pending: await readPendingRunDecision(ctx, row, campaign, membership)
    })
  }
})
