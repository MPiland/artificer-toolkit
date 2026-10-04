import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { getVisibleCampaignConditions } from '@artificer-toolkit/rules-runtime/character/campaignConditionVisibility'
import { projectCharacterSheetBundle } from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import type { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'

type RoomCharacterSheetFacts = Awaited<ReturnType<typeof prepareRoomLiveCharacterSheet>>

/** The unprojected Sheet over prepared room facts, the same bundle Convex's Sheet reads build. */
export function projectRoomCharacterSheet(
  facts: RoomCharacterSheetFacts,
  activeEffects: ActiveRuleEffectRecord[]
) {
  return projectCharacterSheetBundle({
    character: facts.prepared.character,
    resolution: facts.prepared.resolution,
    streamVersion: facts.active.play.streamVersion,
    adjustments: facts.adjustments,
    additionalConditions: getVisibleCampaignConditions(facts.campaignContext),
    additionalCurrencyOptions: facts.campaignContext.currencyOptions,
    creaturesById: facts.prepared.context.creaturesById,
    vehiclesById: facts.prepared.context.vehiclesById,
    spellCustomizations: facts.sheetState.spellCustomizations,
    ruleEvaluation: facts.ruleEvaluation,
    activeEffects
  }).sheet
}

/**
 * The Sheet as `viewer` reads it, with the same redactions as `sheetSlices.get`. Prepared facts
 * carry only an owner or GM viewer, so a party member's read overrides it.
 */
export function projectRoomCharacterSheetForViewer(
  facts: RoomCharacterSheetFacts,
  activeEffects: ActiveRuleEffectRecord[],
  viewer: CharacterSheetResponseDto['meta']['viewer'] = facts.campaignContext.viewer
): CharacterSheetResponseDto {
  const sheet = projectRoomCharacterSheet(facts, activeEffects)
  return projectCharacterSheetForViewer(
    {
      ...sheet,
      meta: { ...sheet.meta, partyVisibility: facts.sheetState.partyVisibility }
    },
    { ...facts.campaignContext, viewer }
  )
}
