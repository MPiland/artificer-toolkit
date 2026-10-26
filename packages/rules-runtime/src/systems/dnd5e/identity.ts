import type { CreatureConditionCapabilityAdapter } from '../../creatureConditionCapability.js'

/** Stable identities are also used by persistence without loading rule discovery or execution. */
export const DND5E_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
export const DND5E_REACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d2'
export const DND5E_FREE_REACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d9'
export const DND5E_ACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d7'
export const DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d8'
/** The SRD Unconscious condition, which a Character gains on dropping to 0 hit points. */
export const DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID = '00000000-0000-0000-0002-000f00000000'
/** The SRD Poisoned condition, which a save against poison damage is treated as being against. */
export const DND5E_POISONED_CONDITION_DEFINITION_ID = '00000000-0000-0000-0002-000b00000000'
/** The SRD Poison damage type. */
export const DND5E_POISON_DAMAGE_TYPE_DEFINITION_ID = '00000000-0000-0000-0004-000900000000'
/** The SRD ability definitions by authored ability code; a Creature's save rows are keyed by id. */
export const DND5E_ABILITY_DEFINITION_ID_BY_CODE: Readonly<Record<string, string>> = {
  STRENGTH: '00000000-0000-0000-0011-000100000000',
  DEXTERITY: '00000000-0000-0000-0011-000200000000',
  CONSTITUTION: '00000000-0000-0000-0011-000300000000',
  INTELLIGENCE: '00000000-0000-0000-0011-000400000000',
  WISDOM: '00000000-0000-0000-0011-000500000000',
  CHARISMA: '00000000-0000-0000-0011-000600000000'
}
/** The authored ability code of an SRD ability definition id. */
export function dnd5eAbilityCode(abilityDefinitionId: string) {
  const code = Object.entries(DND5E_ABILITY_DEFINITION_ID_BY_CODE).find(
    ([, id]) => id === abilityDefinitionId
  )?.[0]
  if (code === undefined) throw new Error('The ability definition is not a D&D ability.')
  return code
}
/** The SRD Exhaustion condition, whose level a Character's exhaustion records. */
export const DND5E_EXHAUSTION_CONDITION_DEFINITION_ID = '00000000-0000-0000-0002-000400000000'

export const dnd5eCreatureConditionCapabilityAdapter: CreatureConditionCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  // Unconscious, while dying.
  zeroHitPointsConditionDefinitionId: DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID,
  exhaustionConditionDefinitionId: DND5E_EXHAUSTION_CONDITION_DEFINITION_ID
}
