import type { CharacterSheetCurrencyOptionDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CampaignConditionDto } from '@artificer-toolkit/schema/api/campaignLiveState'
import type { CharacterRestPreviewResponseDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'
import { hideActiveGrantSources, hideConcentrationSource } from '../activeGrantListings.js'
import { sameCharacterSheetAdjustmentSlot } from './sheetAdjustmentIdentity.js'
import { presentCampaignCharacterText } from './campaignCharacterPresentation.js'

export type CharacterSheetViewer = CharacterSheetResponseDto['meta']['viewer']

export interface CharacterSheetCampaignContext {
  viewer: CharacterSheetViewer
  /** The caller owns the Campaign; unlike `viewer`, true on the GM's own Character (D92). */
  isCampaignOwner: boolean
  campaignId: string | null
  campaignStatus: 'ACTIVE' | 'ARCHIVED' | null
  contentMaturity: 'STANDARD' | 'MATURE' | null
  attunementSlotOverride: number | null
  adjustments: CharacterSheetAdjustment[]
  secretAdjustmentIds: Set<string>
  conditions: CampaignConditionDto[]
  currencyOptions?: CharacterSheetCurrencyOptionDto[]
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

/** Player-private notes: item, extra and spell notes and the Sheet's own note book. */
function withoutPlayerNotes(sheet: CharacterSheetResponseDto): CharacterSheetResponseDto {
  return {
    ...sheet,
    inventory: {
      ...sheet.inventory,
      items: sheet.inventory.items.map((item) => {
        const sanitized = { ...item }
        delete sanitized.notes
        return sanitized
      })
    },
    extras: {
      ...sheet.extras,
      items: sheet.extras.items.map((extra) => {
        const sanitized = { ...extra }
        delete sanitized.notes
        return sanitized
      })
    },
    spells: {
      ...sheet.spells,
      spells: sheet.spells.spells.map((spell) => ({
        ...spell,
        sources: spell.sources?.map((source) => {
          const sanitized = { ...source }
          delete sanitized.notes
          return sanitized
        })
      }))
    },
    notes: { ...sheet.notes, notes: undefined, groups: undefined, items: undefined },
    meta: { ...sheet.meta, hasBuilderDraft: false }
  }
}

/** Personality and background are never shown to other players (ADR 0034 decision 5). */
function withoutPersonalityAndBackground(
  sheet: CharacterSheetResponseDto
): CharacterSheetResponseDto {
  return {
    ...sheet,
    // The identity concept repeats the backstory.
    identity: { ...sheet.identity, concept: undefined },
    notes: {
      ...sheet.notes,
      personalityTraits: undefined,
      ideals: undefined,
      bonds: undefined,
      flaws: undefined,
      organizations: undefined,
      allies: undefined,
      enemies: undefined,
      backstory: undefined
    }
  }
}

export function projectCharacterSheetForViewer(
  sheet: CharacterSheetResponseDto,
  context: CharacterSheetCampaignContext
): CharacterSheetResponseDto {
  const { partyVisibility, ...sharedMeta } = sheet.meta
  const gmControls = context.isCampaignOwner && context.campaignStatus === 'ACTIVE'
  const projected = {
    ...sheet,
    meta: {
      ...sharedMeta,
      ...(context.viewer === 'CHARACTER_OWNER' && partyVisibility ? { partyVisibility } : {}),
      campaignId: context.campaignId,
      viewer: context.viewer,
      capabilities:
        context.viewer === 'CHARACTER_OWNER'
          ? {
              managePlayState: true,
              managePrivateNotes: true,
              manageInventory: true,
              openBuilder: true,
              endActiveEffects: gmControls,
              removeConsequences: gmControls
            }
          : context.viewer === 'CAMPAIGN_OWNER'
            ? {
                managePlayState: context.campaignStatus === 'ACTIVE',
                managePrivateNotes: false,
                manageInventory: context.campaignStatus === 'ACTIVE',
                openBuilder: false,
                endActiveEffects: gmControls,
                removeConsequences: gmControls
              }
            : {
                managePlayState: false,
                managePrivateNotes: false,
                manageInventory: false,
                openBuilder: false,
                endActiveEffects: gmControls,
                removeConsequences: gmControls
              }
    }
  }
  if (context.viewer === 'CAMPAIGN_OWNER')
    return presentCampaignCharacterText(
      withoutPlayerNotes(projected),
      context.contentMaturity,
      context.viewer
    )
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
  const shown = {
    ...projected,
    overview: {
      ...projected.overview,
      ...(secretMaximumOverride ? { maxHitPointsOverride: null } : {}),
      ...(secretMaximumModifier
        ? { maxHitPointsModifier: 0, maxHitPointsModifierAdjustmentId: null }
        : {}),
      // Only the GM learns what a hidden attacker used (D62).
      maxHitPointsReductions: projected.overview.maxHitPointsReductions.map((reduction) =>
        reduction.sourceHidden ? { ...reduction, label: null } : reduction
      ),
      activeGrants: hideActiveGrantSources(projected.overview.activeGrants),
      // Only the caster and the GM end a Concentration (SPELLS-5.11); a hidden source stays unnamed.
      concentration:
        context.viewer === 'PARTY_MEMBER'
          ? null
          : hideConcentrationSource(projected.overview.concentration)
    }
  }
  return presentCampaignCharacterText(
    context.viewer === 'PARTY_MEMBER'
      ? withoutPersonalityAndBackground(withoutPlayerNotes(shown))
      : shown,
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
