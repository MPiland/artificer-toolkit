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
import { query } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import {
  readEncounterWaitingOn,
  readPendingRunDecision
} from '@artificer-toolkit/encounter-persistence/pendingReads'
import { presentRun, readActiveRun } from './projectionReads'
import { readTurnMovementView } from '@artificer-toolkit/encounter-persistence/turnMovement'
import { encounterReadTransaction } from './encounterPorts'

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
    if (!row) return { encounter: null, pending: null, waitingOn: null, turnMovement: [] }
    const encounter = await presentRun(ctx, row, campaign, membership)
    const pending = await readPendingRunDecision(
      encounterReadTransaction(ctx),
      row,
      campaign,
      membership
    )
    return encounterSessionStateDtoSchema.parse({
      encounter,
      pending,
      waitingOn: pending
        ? null
        : await readEncounterWaitingOn(encounterReadTransaction(ctx), row, campaign),
      turnMovement: await readTurnMovementView(encounterReadTransaction(ctx), {
        row,
        campaign,
        membership
      })
    })
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
    const { userId } = await requireIdentity(ctx)
    const [run, occurrence] = await Promise.all([
      ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', encounterId))
        .unique(),
      ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
        .unique()
    ])
    if (!run) throw new Error('Encounter is unavailable.')
    await requireCampaignAuthority(ctx, run.campaignId, userId)
    if (!occurrence || occurrence.encounterId !== run.id)
      throw new Error('Rule occurrence is unavailable.')
    if (occurrence.state === 'PENDING' && occurrence.version === input.occurrenceVersion)
      return null
    const skip = await ctx.db
      .query('encounterDecisionSkips')
      .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (q) =>
        q
          .eq('encounterId', run.id)
          .eq('occurrenceId', occurrence.id)
          .eq('occurrenceVersion', input.occurrenceVersion)
      )
      .unique()
    return skip ? 'GM_SKIP' : 'ANSWER'
  }
})
