import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { z } from 'zod'
import {
  campaignAdjustmentsDtoSchema,
  campaignConditionsDtoSchema,
  listCampaignAdjustmentsInputSchema,
  type CampaignAdjustmentDto,
  type CampaignConditionDto
} from '@artificer-toolkit/schema/api/campaignLiveState'
import { getCharacterSheetAdjustmentSlotKey } from '@artificer-toolkit/rules-runtime/character/sheetAdjustmentIdentity'
import { query, type QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { readCampaignCharacterState, requireCampaignCharacterAuthority } from './characterState'

async function readState(ctx: QueryCtx, args: z.input<typeof listCampaignAdjustmentsInputSchema>) {
  const input = listCampaignAdjustmentsInputSchema.parse(args)
  const { userId } = await requireIdentity(ctx)
  const { campaign, membership } = await requireCampaignCharacterAuthority(
    ctx,
    input.campaignId,
    input.characterId,
    userId
  )
  const characterId = input.characterId.toLowerCase()
  const { state } = await readCampaignCharacterState(ctx, campaign.id, characterId)
  return { state, owner: membership.role === 'OWNER' }
}

export const adjustments = query({
  args: zodToConvexFields(listCampaignAdjustmentsInputSchema.shape),
  returns: zodToConvex(campaignAdjustmentsDtoSchema),
  handler: async (ctx, args): Promise<CampaignAdjustmentDto[]> => {
    const { state, owner } = await readState(ctx, args)
    return campaignAdjustmentsDtoSchema.parse(
      state.adjustments
        .filter((record) => owner || record.visibility === 'VISIBLE')
        .sort(
          (left, right) =>
            left.adjustment.family.localeCompare(right.adjustment.family) ||
            getCharacterSheetAdjustmentSlotKey(left.adjustment).localeCompare(
              getCharacterSheetAdjustmentSlotKey(right.adjustment)
            ) ||
            left.id.localeCompare(right.id)
        )
        .map(({ createdBy: _createdBy, ...record }) => record)
    )
  }
})

export const conditions = query({
  args: zodToConvexFields(listCampaignAdjustmentsInputSchema.shape),
  returns: zodToConvex(campaignConditionsDtoSchema),
  handler: async (ctx, args): Promise<CampaignConditionDto[]> => {
    const { state, owner } = await readState(ctx, args)
    return campaignConditionsDtoSchema.parse(
      state.conditions
        .filter((record) => owner || record.visibility === 'VISIBLE')
        .sort(
          (left, right) =>
            left.conditionTypeId.localeCompare(right.conditionTypeId) ||
            left.id.localeCompare(right.id)
        )
        .map(({ createdBy: _createdBy, ...record }) => record)
    )
  }
})
