import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { evaluateCharacterActiveGrantRules } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import { getVisibleCampaignConditions } from '@artificer-toolkit/rules-runtime/character/campaignConditionVisibility'
import { projectCharacterSheetBundle } from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import type { EncounterSpellSummon } from '@artificer-toolkit/rules-runtime/character/sheetSpellSummon'
import type { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'

/** The Concentrations a Character holds: what they keep alive and the ids of its live states. */
export type RoomCharacterConcentrations = {
  effects: readonly ActiveRuleEffectRecord[]
  stateIds: readonly string[]
}

type RoomCharacterSheetFacts = Awaited<ReturnType<typeof prepareRoomLiveCharacterSheet>>

/** The unprojected Sheet over prepared room facts, the same bundle Convex's Sheet reads build. */
export function projectRoomCharacterSheet(
  facts: RoomCharacterSheetFacts,
  activeEffects: ActiveRuleEffectRecord[],
  /**
   * Only the Sheet a client reads names the Concentration and the damage dice its effects add
   * against their holders; the numbers other readers take never depend on it.
   */
  concentrations: RoomCharacterConcentrations | null = null,
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
    ruleEvaluation: evaluateCharacterActiveGrantRules({
      gameSystemId: facts.prepared.character.systemId,
      evaluation: facts.ruleEvaluation,
      activeEffects,
      vocabularySnapshot: facts.prepared.context.vocabularySnapshot
    }),
    activeEffects,
    concentrationEffects: concentrations?.effects ?? null,
    heldConcentrationStateIds: concentrations?.stateIds ?? [],
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
  concentrations: RoomCharacterConcentrations | null = null,
  encounterSummons: readonly EncounterSpellSummon[] = []
): CharacterSheetResponseDto {
  const sheet = projectRoomCharacterSheet(facts, activeEffects, concentrations, encounterSummons)
  return projectCharacterSheetForViewer(
    {
      ...sheet,
      meta: { ...sheet.meta, partyVisibility: facts.sheetState.partyVisibility }
    },
    { ...facts.campaignContext, viewer }
  )
}
