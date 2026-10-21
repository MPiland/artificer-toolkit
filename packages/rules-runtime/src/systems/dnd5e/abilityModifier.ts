import type { AbilityScoreCapabilityAdapter } from '../../abilityScoreCapability.js'
import {
  DND5E_ABILITY_DEFINITION_ID_BY_CODE,
  DND5E_SYSTEM_ID,
  dnd5eAbilityCode
} from './identity.js'

/** The 5e modifier of an ability score. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/**
 * The value an ABILITY_MODIFIER_BONUS grant adds: the ability modifier scaled by the grant's
 * multiplier and clamped to its min/max (medium armor's +2 Dexterity cap).
 */
export function resolveAbilityModifierBonus(
  modifier: number,
  payload: { readonly multiplier?: number; readonly min?: number; readonly max?: number }
): number {
  return Math.max(
    payload.min ?? -999,
    Math.min(payload.max ?? 999, modifier * (payload.multiplier ?? 1))
  )
}

export const dnd5eAbilityScoreCapabilityAdapter: AbilityScoreCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  abilityModifier,
  abilityDefinitionIdByCode: DND5E_ABILITY_DEFINITION_ID_BY_CODE,
  abilityCode: dnd5eAbilityCode,
  // Intelligence, Wisdom and Charisma; the form brings the physical ones.
  formRetainedAbilityIds: {
    INTELLIGENCE: DND5E_ABILITY_DEFINITION_ID_BY_CODE.INTELLIGENCE!,
    WISDOM: DND5E_ABILITY_DEFINITION_ID_BY_CODE.WISDOM!,
    CHARISMA: DND5E_ABILITY_DEFINITION_ID_BY_CODE.CHARISMA!
  }
}
