import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ConcentrationListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { getVisibleCampaignConditions } from '@artificer-toolkit/rules-runtime/character/campaignConditionVisibility'
import { projectCharacterSheetBundle } from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import type { EncounterSpellSummon } from '@artificer-toolkit/rules-runtime/character/sheetSpellSummon'
import type { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'

type RoomCharacterSheetFacts = Awaited<ReturnType<typeof prepareRoomLiveCharacterSheet>>

/** The unprojected Sheet over prepared room facts, the same bundle Convex's Sheet reads build. */
export function projectRoomCharacterSheet(
  facts: RoomCharacterSheetFacts,
  activeEffects: ActiveRuleEffectRecord[],
  /** Only the Sheet a client reads names the Concentration; the numbers other readers take never depend on it. */
  concentration: ConcentrationListingDto | null = null,
  /** The summons the Character's Run actor owns, which the client's Sheet lists in Extras. */
  encounterSummons: readonly EncounterSpellSummon[] = []
) {
  return projectCharacterSheetBundle({
    character: facts.prepared.character,
    resolution: facts.prepared.resolution,
    streamVersion: facts.active.play.streamVersion,
    adjustments: facts.adjustments,
    additionalConditions: getVisibleCampaignConditions(facts.campaignContext),
    additionalCurrencyOptions: facts.campaignContext.currencyOptions,
    presentation: facts.prepared.context.presentation,
    spellCustomizations: facts.sheetState.spellCustomizations,
    ruleEvaluation: facts.ruleEvaluation,
    activeEffects,
    concentration,
    encounterSummons
  }).sheet
}

/**
 * The Sheet as `viewer` reads it, with the same redactions as `sheetSlices.get`. Prepared facts
 * carry only an owner or GM viewer, so a party member's read overrides it.
 */
export function projectRoomCharacterSheetForViewer(
  facts: RoomCharacterSheetFacts,
  activeEffects: ActiveRuleEffectRecord[],
  viewer: CharacterSheetResponseDto['meta']['viewer'] = facts.campaignContext.viewer,
  concentration: ConcentrationListingDto | null = null,
  encounterSummons: readonly EncounterSpellSummon[] = []
): CharacterSheetResponseDto {
  const sheet = projectRoomCharacterSheet(facts, activeEffects, concentration, encounterSummons)
  return projectCharacterSheetForViewer(
    {
      ...sheet,
      meta: { ...sheet.meta, partyVisibility: facts.sheetState.partyVisibility }
    },
    { ...facts.campaignContext, viewer }
  )
}
