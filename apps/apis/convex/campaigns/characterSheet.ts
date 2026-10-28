import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { listCampaignAdjustmentsInputSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import {
  campaignCharacterBasicsDtoSchema,
  campaignCharacterSheetExecuteInputSchema,
  campaignCharacterSheetPanelInputSchema,
  campaignCharacterRestPreviewInputSchema,
  campaignCharacterSheetRollInputSchema,
  type CampaignCharacterBasicsDto
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
import { characterSheetCommandValidator } from '../characters/sheetCommandValidator'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet } from '../characters/sheetPreparation'
import { executeCharacterSheetCommandAcknowledgement } from '../characters/sheetCommands'
import { projectCharacterSheetPanel } from '../characters/panels'
import { projectCharacterPreparationOptions } from '../characters/preparationOptions'
import { characterSheetSection, readStoredCharacterSheetSection } from '../characters/sheetSections'
import { prepareCharacterRest } from '../characters/rest'
import { presentRoll } from '@artificer-toolkit/rules-runtime/character/rollPresentation'
import { evaluateCharacterRoll, retainUserRoll } from '../rollDocuments'
import { readCampaignCharacterReader, requireCampaignCharacterAuthority } from './characterState'

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

/** The GM, the Character's player, or another member while "Party can view" is on. */
async function readCampaignCharacterSheetForMember(
  ctx: QueryCtx,
  userId: string,
  campaignId: string,
  characterId: string
) {
  const reader = await readCampaignCharacterReader(ctx, campaignId, characterId, userId)
  const current = await loadCharacterSheet(ctx, reader.loadAsUserId, characterId, campaignId)
  if (!current) throw new Error('Assigned Character not found.')
  return { current, party: reader.party }
}

export const get = query({
  args: zodToConvexFields(listCampaignAdjustmentsInputSchema.shape),
  returns: zodToConvex(characterSheetResponseDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, characterId } = listCampaignAdjustmentsInputSchema.parse(args)
    const { current, party } = await readCampaignCharacterSheetForMember(
      ctx,
      userId,
      campaignId,
      characterId
    )
    if (party && !current.sheetState.partyVisibility.sheet)
      throw new Error('Assigned Character not found.')
    return characterSheetResponseDtoSchema.parse(
      projectCharacterSheetForViewer(
        current.sheet,
        party ? { ...current.campaignContext, viewer: 'PARTY_MEMBER' } : current.campaignContext
      )
    )
  }
})

/** Public roster basics (name, level, class) for any active member (ADR 0034 decision 5). */
export const basics = query({
  args: zodToConvexFields(listCampaignAdjustmentsInputSchema.shape),
  returns: zodToConvex(campaignCharacterBasicsDtoSchema),
  handler: async (ctx, args): Promise<CampaignCharacterBasicsDto> => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, characterId } = listCampaignAdjustmentsInputSchema.parse(args)
    const { current } = await readCampaignCharacterSheetForMember(
      ctx,
      userId,
      campaignId,
      characterId
    )
    return campaignCharacterBasicsDtoSchema.parse({
      characterId: current.active.id,
      label: current.sheet.identity.label,
      classSummary: current.sheet.identity.classSummary,
      totalLevel: current.sheet.identity.totalLevel,
      sheetVisible: current.sheetState.partyVisibility.sheet
    })
  }
})

export const panel = query({
  args: zodToConvexFields(campaignCharacterSheetPanelInputSchema.shape),
  returns: zodToConvex(characterSheetPanelDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, characterId, target } = campaignCharacterSheetPanelInputSchema.parse(args)
    const stored = await readStoredCharacterSheetSection(ctx, {
      userId,
      lookupId: characterId,
      campaignId,
      section: characterSheetSection.panel(target)
    })
    if (stored !== undefined) return characterSheetPanelDtoSchema.parse(stored)
    const current = await loadCharacterSheet(
      ctx,
      userId,
      characterId,
      campaignId,
      undefined,
      target.kind === 'PROFICIENCIES' ? 'resolution' : 'active',
      undefined,
      target.kind === 'SPELL' ? [target.source.spellId] : []
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
    const stored = await readStoredCharacterSheetSection(ctx, {
      userId,
      lookupId: characterId,
      campaignId,
      section: characterSheetSection.preparation
    })
    if (stored !== undefined) return characterPreparationOptionsResponseDtoSchema.parse(stored)
    const current = await loadCharacterSheet(ctx, userId, characterId, campaignId)
    if (!current) throw new Error('Assigned Character not found.')
    return projectCharacterPreparationOptions(ctx, current)
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
  args: {
    ...zodToConvexFields(listCampaignAdjustmentsInputSchema.shape),
    command: characterSheetCommandValidator
  },
  returns: zodToConvex(characterSheetCommandResponseDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { campaignId, characterId, command } =
      campaignCharacterSheetExecuteInputSchema.parse(args)
    return executeCharacterSheetCommandAcknowledgement(
      ctx,
      userId,
      { id: characterId, command },
      campaignId
    )
  }
})
