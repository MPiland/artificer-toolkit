import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { CharacterMovementFacts } from '../encounterMovementTargets.js'
import type { CharacterSheetCampaignContext } from './campaignCharacterSheet.js'
import { getVisibleCampaignConditions } from './campaignConditionVisibility.js'
import { requireCharacterPresentation } from './contextPreparation.js'
import type { CharacterSpellCastActions } from './characterSpellCastActions.js'
import type { prepareCharacterSheetFromContext } from './sheetPreparation.js'
import { projectCharacterSheetBundle } from './sheetProjection.js'

type PreparedSheet = Awaited<ReturnType<typeof prepareCharacterSheetFromContext>>

/**
 * The Character facts a live turn reads: the movement facts plus what the Sheet's actions are
 * projected from. Convex and the room each assemble them from their own stored inputs.
 */
export type CharacterTurnFacts = CharacterMovementFacts &
  Pick<PreparedSheet, 'adjustments'> & {
    sheetState: Pick<CharacterSheetState, 'resourceUsage' | 'itemUsage' | 'spellCustomizations'>
    campaignContext: CharacterSheetCampaignContext
    prepared: Pick<PreparedSheet['prepared'], 'character' | 'resolution'> & {
      context: Pick<PreparedSheet['prepared']['context'], 'presentation'>
    }
    activeEffects: ActiveRuleEffectRecord[]
  }

/**
 * The Sheet's actions as the Character's own Sheet lists them, under the policy a turn evaluates,
 * followed by the spell casts the turn offers (decisions the Sheet's own actions never carry).
 */
export function projectCharacterTurnActions(
  facts: CharacterTurnFacts,
  rulePolicyOutput: CharacterRulePolicyOutput,
  spellCastDecisions: CharacterSpellCastActions['decisions']
) {
  return projectCharacterSheetBundle({
    character: facts.prepared.character,
    resolution: facts.prepared.resolution,
    streamVersion: facts.active.play.streamVersion,
    adjustments: facts.adjustments,
    additionalConditions: getVisibleCampaignConditions(facts.campaignContext),
    additionalCurrencyOptions: facts.campaignContext.currencyOptions,
    presentation: requireCharacterPresentation(facts.prepared.context).presentation,
    spellCustomizations: facts.sheetState.spellCustomizations,
    ruleEvaluation: {
      ...facts.ruleEvaluation,
      output: {
        ...rulePolicyOutput,
        actionDecisions: [...rulePolicyOutput.actionDecisions, ...spellCastDecisions]
      }
    },
    activeEffects: facts.activeEffects,
    concentrationEffects: null
  }).sheet.actions.items
}
