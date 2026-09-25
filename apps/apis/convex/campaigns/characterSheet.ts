import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { listCampaignAdjustmentsInputSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import {
  campaignCharacterSheetExecuteInputSchema,
  campaignCharacterSheetPanelInputSchema,
  campaignCharacterRestPreviewInputSchema,
  campaignCharacterSheetRollInputSchema
} from '@artificer-toolkit/schema/api/campaignCharacterSheet'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { characterSheetResponseDtoSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import { characterSheetPanelDtoSchema } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { characterPreparationOptionsResponseDtoSchema } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import {
  characterRestPreviewResponseDtoSchema,
  characterSheetCommandResponseDtoSchema
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import {
  projectCharacterRestForViewer,
  projectCharacterSheetForViewer
} from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { query } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet } from '../characters/sheetPreparation'
import { executeCharacterSheetCommand } from '../characters/sheetCommands'
import { projectCharacterSheetPanel } from '../characters/panels'
import { projectCharacterPreparationOptions } from '../characters/preparationOptions'
import { prepareCharacterRest } from '../characters/rest'
import { evaluateCharacterRoll, presentRoll, retainUserRoll } from '../rollDocuments'
import { requireCampaignCharacterAuthority } from './characterState'

export const executeRoll = mutation({
  args: zodToConvexFields(campaignCharacterSheetRollInputSchema.shape),
  returns: zodToConvex(rollRecordDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, ...input } = campaignCharacterSheetRollInputSchema.parse(args)
    const { campaign } = await requireCampaignCharacterAuthority(
      ctx,
      campaignId,
      input.characterId,
      userId
    )
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const { record, maturity } = await evaluateCharacterRoll(ctx, userId, input, campaignId)
    await retainUserRoll(ctx, userId, record, null)
    return presentRoll(record, maturity)
  }
})

export const get = query({
  args: zodToConvexFields(listCampaignAdjustmentsInputSchema.shape),
  returns: zodToConvex(characterSheetResponseDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, characterId } = listCampaignAdjustmentsInputSchema.parse(args)
    const current = await loadCharacterSheet(ctx, userId, characterId, campaignId)
    if (!current) throw new Error('Assigned Character not found.')
    return projectCharacterSheetForViewer(current.sheet, current.campaignContext)
  }
})

export const panel = query({
  args: zodToConvexFields(campaignCharacterSheetPanelInputSchema.shape),
  returns: zodToConvex(characterSheetPanelDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, characterId, target } = campaignCharacterSheetPanelInputSchema.parse(args)
    const current = await loadCharacterSheet(
      ctx,
      userId,
      characterId,
      campaignId,
      undefined,
      target.kind === 'PROFICIENCIES' ? 'resolution' : 'active'
    )
    if (!current) throw new Error('Assigned Character not found.')
    return projectCharacterSheetPanel(current, target)
  }
})

export const preparationOptions = query({
  args: zodToConvexFields(listCampaignAdjustmentsInputSchema.shape),
  returns: zodToConvex(characterPreparationOptionsResponseDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, characterId } = listCampaignAdjustmentsInputSchema.parse(args)
    const current = await loadCharacterSheet(ctx, userId, characterId, campaignId)
    if (!current) throw new Error('Assigned Character not found.')
    return projectCharacterPreparationOptions(current)
  }
})

export const restPreview = query({
  args: zodToConvexFields(campaignCharacterRestPreviewInputSchema.shape),
  returns: zodToConvex(characterRestPreviewResponseDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, characterId, input } = campaignCharacterRestPreviewInputSchema.parse(args)
    const current = await loadCharacterSheet(ctx, userId, characterId, campaignId)
    if (!current) throw new Error('Assigned Character not found.')
    return projectCharacterRestForViewer(
      (await prepareCharacterRest(ctx, userId, current, input)).preview,
      current.campaignContext
    )
  }
})

export const execute = mutation({
  args: zodToConvexFields(campaignCharacterSheetExecuteInputSchema.shape),
  returns: zodToConvex(characterSheetCommandResponseDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, characterId, command } =
      campaignCharacterSheetExecuteInputSchema.parse(args)
    return executeCharacterSheetCommand(ctx, userId, { id: characterId, command }, campaignId)
  }
})
