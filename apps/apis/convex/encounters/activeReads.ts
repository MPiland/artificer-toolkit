import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterDecisionSettlementDtoSchema,
  encounterSessionStateDtoSchema,
  getCampaignEncounterInputDtoSchema,
  getEncounterDecisionSettlementInputDtoSchema,
  type EncounterDecisionSettlementDto,
  type EncounterSessionStateDto
} from '@artificer-toolkit/schema/api/encounterData'
import { query } from '../lib/queries'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import {
  readEncounterDecisionSettlement,
  readEncounterSessionState
} from '@artificer-toolkit/encounter-persistence/sessionReads'
import { readActiveRun } from './projectionReads'
import { encounterReadTransaction } from './encounterReadPorts'
import { readMemberEncounter } from './readAccess'

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
    return encounterSessionStateDtoSchema.parse(
      await readEncounterSessionState(encounterReadTransaction(ctx), {
        row: await readActiveRun(ctx, campaign.id),
        campaign,
        membership
      })
    )
  }
})

/**
 * Who settled a decision the member was shown (D39): the GM's skip or an answer. The waiting
 * player's drawer reads it once the decision leaves `pending`.
 */
export const decisionSettlement = query({
  args: zodToConvexFields(getEncounterDecisionSettlementInputDtoSchema.shape),
  returns: zodToConvex(encounterDecisionSettlementDtoSchema),
  handler: async (ctx, args): Promise<EncounterDecisionSettlementDto> => {
    const input = getEncounterDecisionSettlementInputDtoSchema.parse(args)
    const encounterId = input.encounterId.toLowerCase()
    const occurrenceId = input.occurrenceId.toLowerCase()
    const { run } = await readMemberEncounter(ctx, encounterId)
    return readEncounterDecisionSettlement(encounterReadTransaction(ctx), {
      encounterId: run.id,
      occurrenceId,
      occurrenceVersion: input.occurrenceVersion
    })
  }
})
