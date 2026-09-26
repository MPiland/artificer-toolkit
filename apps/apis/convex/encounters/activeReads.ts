import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterSessionStateDtoSchema,
  getCampaignEncounterInputDtoSchema,
  type EncounterSessionStateDto
} from '@artificer-toolkit/schema/api/encounterData'
import { query } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { readEncounterWaitingOn, readPendingRunDecision } from './pendingReads'
import { presentRun, readActiveRun } from './projectionReads'

/** One authenticated snapshot keeps the tabletop's active Campaign Run and pending decision in sync. */
export const active = query({
  args: zodToConvexFields(getCampaignEncounterInputDtoSchema.shape),
  get returns(): Validator<EncounterSessionStateDto, 'required', string> {
    return zodToConvex<z.core.$ZodType<EncounterSessionStateDto>>(encounterSessionStateDtoSchema)
  },
  handler: async (ctx, args): Promise<EncounterSessionStateDto> => {
    const input = getCampaignEncounterInputDtoSchema.parse({
      campaignId: args.campaignId.toLowerCase()
    })
    const { userId } = await requireIdentity(ctx)
    const { campaign, membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    const row = await readActiveRun(ctx, campaign.id)
    if (!row) return { encounter: null, pending: null, waitingOn: null }
    const encounter = await presentRun(ctx, row, campaign, membership)
    const pending = await readPendingRunDecision(ctx, row, campaign, membership)
    return encounterSessionStateDtoSchema.parse({
      encounter,
      pending,
      waitingOn: pending ? null : await readEncounterWaitingOn(ctx, row, campaign)
    })
  }
})
