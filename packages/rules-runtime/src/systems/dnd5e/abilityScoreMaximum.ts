import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { dnd5eAbilityScoreCapabilityAdapter } from './abilityModifier.js'
import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eAcceptedModifierApplicability,
  dnd5eModifierApplies
} from './modifierApplicability.js'

/**
 * The ceiling an ability score can reach from increases: the highest ABILITY_SCORE_MAXIMUM granted
 * for the ability (or for every ability), never below the System default. A SET_VALUE score and a
 * manual override are not increases and bypass it.
 */
export function dnd5eAbilityScoreMaximum(
  modifiers: readonly CharacterGrantFoldOutput['modifiers'][number][],
  abilityId: string | null
): number {
  return modifiers.reduce((maximum, modifier) => {
    const { payload } = modifier
    if (
      modifier.valueDomainCode !== 'ABILITY_SCORE_MAXIMUM' ||
      modifier.modifierKind !== 'SET_VALUE' ||
      (modifier.domain.ability !== undefined && modifier.domain.ability !== abilityId) ||
      payload === undefined ||
      !('amount' in payload) ||
      !dnd5eModifierApplies(
        dnd5eAcceptedModifierApplicability(modifier),
        DND5E_CHARACTER_WIDE_TARGET
      )
    )
      return maximum
    return Math.max(maximum, payload.amount)
  }, dnd5eAbilityScoreCapabilityAdapter.defaultMaximumScore)
}
