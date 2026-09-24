import type { CharacterSheetCurrencyOptionDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CampaignConditionDto } from '@artificer-toolkit/schema/api/campaignLiveState'
import type { CharacterRestPreviewResponseDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'
import type { CharacterEvent } from '@artificer-toolkit/shared/core'
import { sameCharacterSheetAdjustmentSlot } from './sheetAdjustmentIdentity.js'
import { presentCampaignCharacterText } from './campaignCharacterPresentation.js'

export type CharacterSheetViewer = 'CHARACTER_OWNER' | 'CAMPAIGN_OWNER'

export interface CharacterSheetCampaignContext {
  viewer: CharacterSheetViewer
  campaignId: string | null
  campaignStatus: 'ACTIVE' | 'ARCHIVED' | null
  contentMaturity: 'STANDARD' | 'MATURE' | null
  attunementSlotOverride: number | null
  adjustments: CharacterSheetAdjustment[]
  secretAdjustmentIds: Set<string>
  conditions: CampaignConditionDto[]
  currencyOptions?: CharacterSheetCurrencyOptionDto[]
}

export interface CharacterLiveSessionRuleContext {
  adjustments: CharacterSheetAdjustment[]
  additionalConditions: Array<{ conditionTypeId: string; notes?: string }>
  attunementSlotOverride: number | null
}

export function mergeCampaignSheetAdjustments(
  characterAdjustments: readonly CharacterSheetAdjustment[],
  campaignAdjustments: readonly CharacterSheetAdjustment[]
): CharacterSheetAdjustment[] {
  return [
    ...characterAdjustments.filter(
      (adjustment) =>
        !campaignAdjustments.some((campaign) =>
          sameCharacterSheetAdjustmentSlot(adjustment, campaign)
        )
    ),
    ...campaignAdjustments
  ]
}

export function getCharacterSheetDisplayAdjustments(
  characterAdjustments: readonly CharacterSheetAdjustment[],
  context: CharacterSheetCampaignContext
): CharacterSheetAdjustment[] {
  if (context.viewer === 'CAMPAIGN_OWNER') {
    return mergeCampaignSheetAdjustments(characterAdjustments, context.adjustments)
  }
  const visible = context.adjustments.filter((adjustment) => {
    return !context.secretAdjustmentIds.has(adjustment.id)
  })
  return [
    ...characterAdjustments.filter(
      (adjustment) =>
        !context.adjustments.some((campaign) =>
          sameCharacterSheetAdjustmentSlot(adjustment, campaign)
        )
    ),
    ...visible
  ]
}

export function getVisibleCampaignConditions(
  context: Pick<CharacterSheetCampaignContext, 'viewer' | 'conditions'>
): Array<{ conditionTypeId: string; notes?: string }> {
  return context.conditions
    .filter(
      (condition) => context.viewer === 'CAMPAIGN_OWNER' || condition.visibility === 'VISIBLE'
    )
    .map(({ conditionTypeId, notes }) => ({
      conditionTypeId,
      ...(notes ? { notes } : {})
    }))
}

export function projectCharacterSheetForViewer(
  sheet: CharacterSheetResponseDto,
  context: CharacterSheetCampaignContext
): CharacterSheetResponseDto {
  const projected = {
    ...sheet,
    meta: {
      ...sheet.meta,
      campaignId: context.campaignId,
      viewer: context.viewer,
      capabilities:
        context.viewer === 'CHARACTER_OWNER'
          ? {
              managePlayState: true,
              managePrivateNotes: true,
              manageInventory: true,
              openBuilder: true
            }
          : {
              managePlayState: context.campaignStatus === 'ACTIVE',
              managePrivateNotes: false,
              manageInventory: context.campaignStatus === 'ACTIVE',
              openBuilder: false
            }
    }
  }
  if (context.viewer === 'CAMPAIGN_OWNER') {
    const inventoryItems = projected.inventory.items.map((item) => {
      const sanitized = { ...item }
      delete sanitized.notes
      return sanitized
    })
    const extras = projected.extras.items.map((extra) => {
      const sanitized = { ...extra }
      delete sanitized.notes
      return sanitized
    })
    const spells = projected.spells.spells.map((spell) => ({
      ...spell,
      sources: spell.sources?.map((source) => {
        const sanitized = { ...source }
        delete sanitized.notes
        return sanitized
      })
    }))
    return presentCampaignCharacterText(
      {
        ...projected,
        inventory: {
          ...projected.inventory,
          items: inventoryItems
        },
        extras: {
          ...projected.extras,
          items: extras
        },
        spells: {
          ...projected.spells,
          spells
        },
        notes: {
          ...projected.notes,
          notes: undefined,
          groups: undefined,
          items: undefined
        },
        meta: {
          ...projected.meta,
          hasBuilderDraft: false
        }
      },
      context.contentMaturity,
      context.viewer
    )
  }
  const secretMaximumOverride = context.adjustments.some(
    (adjustment) =>
      adjustment.family === 'HIT_POINTS' &&
      adjustment.field === 'MAXIMUM_OVERRIDE' &&
      context.secretAdjustmentIds.has(adjustment.id)
  )
  const secretMaximumModifier = context.adjustments.some(
    (adjustment) =>
      adjustment.family === 'HIT_POINTS' &&
      adjustment.field === 'MAXIMUM_MODIFIER' &&
      context.secretAdjustmentIds.has(adjustment.id)
  )
  if (!secretMaximumOverride && !secretMaximumModifier) {
    return presentCampaignCharacterText(projected, context.contentMaturity, context.viewer)
  }
  return presentCampaignCharacterText(
    {
      ...projected,
      overview: {
        ...projected.overview,
        ...(secretMaximumOverride ? { maxHitPointsOverride: null } : {}),
        ...(secretMaximumModifier
          ? { maxHitPointsModifier: 0, maxHitPointsModifierAdjustmentId: null }
          : {})
      }
    },
    context.contentMaturity,
    context.viewer
  )
}

export function projectCharacterRestForViewer(
  preview: CharacterRestPreviewResponseDto,
  context: CharacterSheetCampaignContext
): CharacterRestPreviewResponseDto {
  if (context.viewer === 'CAMPAIGN_OWNER') {
    return presentCampaignCharacterText(
      {
        ...preview,
        hitPoints: {
          ...preview.hitPoints,
          maximumHitPointModifier: 0,
          canResetMaximumHitPointModifier: false
        }
      },
      context.contentMaturity,
      context.viewer
    )
  }
  if (
    !context.adjustments.some(
      (adjustment) =>
        adjustment.family === 'HIT_POINTS' &&
        adjustment.field === 'MAXIMUM_MODIFIER' &&
        context.secretAdjustmentIds.has(adjustment.id)
    )
  )
    return presentCampaignCharacterText(preview, context.contentMaturity, context.viewer)
  return presentCampaignCharacterText(
    {
      ...preview,
      hitPoints: {
        ...preview.hitPoints,
        maximumHitPointModifier: 0,
        canResetMaximumHitPointModifier: false
      }
    },
    context.contentMaturity,
    context.viewer
  )
}

export function filterCharacterHistoryForViewer(
  events: readonly CharacterEvent[],
  characterOwnerId: string,
  viewer: CharacterSheetViewer
): CharacterEvent[] {
  return viewer === 'CAMPAIGN_OWNER'
    ? [...events]
    : events.filter((event) => event.actorId === characterOwnerId)
}
