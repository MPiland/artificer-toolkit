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
import { memoizeTransactionReads } from '@artificer-toolkit/encounter-persistence/transactionReads'
import type { QueryCtx } from '../_generated/server'
import { readActiveRun } from './projectionReads'
import { encounterReadTransaction } from './encounterReadPorts'
import { readMemberEncounter } from './readAccess'

/** One authenticated snapshot keeps the tabletop's active Campaign Run and pending decision in sync. */
export const active = query({
  args: () => zodToConvexFields(getCampaignEncounterInputDtoSchema.shape),
  returns: (): Validator<EncounterSessionStateDto, 'required', string> => {
    return zodToConvex<z.core.$ZodType<EncounterSessionStateDto>>(encounterSessionStateDtoSchema)
  },
  handler: async (ctx, args): Promise<EncounterSessionStateDto> => {
    const input = getCampaignEncounterInputDtoSchema.parse({
      campaignId: args.campaignId.toLowerCase()
    })
    return encounterSessionStateDtoSchema.parse(
      await readActiveEncounterSession(ctx, input.campaignId)
    )
  }
})

/**
 * The caller's session state for the Campaign. Its ports each re-check what they read (the
 * Campaign, memberships, assignments, Character heads and play), so the same documents are read
 * many times; the transaction serves each identical read once and derives each document once
 * (PERF-6.T9, `activeReadBudget.test.ts`).
 */
export async function readActiveEncounterSession(ctx: QueryCtx, campaignId: string) {
  const read: QueryCtx = { ...ctx, db: memoizeTransactionReads(ctx.db) }
  const { userId } = await requireIdentity(read)
  const { campaign, membership } = await requireCampaignAuthority(read, campaignId, userId)
  return readEncounterSessionState(encounterReadTransaction(read), {
    row: await readActiveRun(read, campaign.id),
    campaign,
    membership
  })
}

/**
 * Who settled a decision the member was shown (D39): the GM's skip or an answer. The waiting
 * player's drawer reads it once the decision leaves `pending`.
 */
export const decisionSettlement = query({
  args: () => zodToConvexFields(getEncounterDecisionSettlementInputDtoSchema.shape),
  returns: () => zodToConvex(encounterDecisionSettlementDtoSchema),
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
