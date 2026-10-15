import type { CoreMeta } from './core.js'
import { valuesOf } from '#utils'

export const ABILITY_CODE = {
  CHARISMA: 'CHARISMA',
  CONSTITUTION: 'CONSTITUTION',
  DEXTERITY: 'DEXTERITY',
  INTELLIGENCE: 'INTELLIGENCE',
  STRENGTH: 'STRENGTH',
  WISDOM: 'WISDOM'
} as const

export type AbilityCode = keyof typeof ABILITY_CODE

export type AbilityOption = CoreMeta<AbilityCode>

export const ABILITIES: Record<AbilityCode, AbilityOption> = {
  [ABILITY_CODE.STRENGTH]: {
    code: ABILITY_CODE.STRENGTH,
    label: 'Strength',
    short: 'STR',
    description: 'Strength measures physical power, bodily force, and the ability to exert muscle.'
  },
  [ABILITY_CODE.DEXTERITY]: {
    code: ABILITY_CODE.DEXTERITY,
    label: 'Dexterity',
    short: 'DEX',
    description: 'Dexterity measures agility, reflexes, balance, and precise control of movement.'
  },
  [ABILITY_CODE.CONSTITUTION]: {
    code: ABILITY_CODE.CONSTITUTION,
    label: 'Constitution',
    short: 'CON',
    description: 'Constitution measures endurance, stamina, and overall bodily health.'
  },
  [ABILITY_CODE.INTELLIGENCE]: {
    code: ABILITY_CODE.INTELLIGENCE,
    label: 'Intelligence',
    short: 'INT',
    description: 'Intelligence measures reasoning ability, memory, and analytical thinking.'
  },
  [ABILITY_CODE.WISDOM]: {
    code: ABILITY_CODE.WISDOM,
    label: 'Wisdom',
    short: 'WIS',
    description: 'Wisdom measures perception, intuition, awareness, and insight.'
  },
  [ABILITY_CODE.CHARISMA]: {
    code: ABILITY_CODE.CHARISMA,
    label: 'Charisma',
    short: 'CHA',
    description: 'Charisma measures confidence, presence, and the ability to influence others.'
  }
} as const

export const ABILITY_OPTIONS = valuesOf(ABILITIES) as readonly AbilityOption[]

export const SPELLCASTING_ABILITY_REFERENCE = 'SPELLCASTING' as const

/**
 * References either a concrete ability or the spellcasting ability supplied by
 * the effect's source. This is not an ability score and must not be used as a
 * key in ability-score records.
 */
export type AbilityModifierReference = AbilityCode | typeof SPELLCASTING_ABILITY_REFERENCE

export type AbilityModifierReferenceOption = CoreMeta<AbilityModifierReference>

export const ABILITY_MODIFIER_REFERENCE_OPTIONS: readonly AbilityModifierReferenceOption[] = [
  ...ABILITY_OPTIONS,
  {
    code: SPELLCASTING_ABILITY_REFERENCE,
    label: 'Spellcasting',
    description: 'Source spellcasting ability.'
  }
]
