import type { CoreMeta } from './core.js'
import { valuesOf } from '#utils'

export const ABILITY_CODE = {
  CHARISMA: 'CHARISMA',
  CONSTITUTION: 'CONSTITUTION',
  DEXTERITY: 'DEXTERITY',
  INTELLIGENCE: 'INTELLIGENCE',
  STRENGTH: 'STRENGTH',
  WISDOM: 'WISDOM',
  SPELLCASTING: 'SPELLCASTING'
} as const

export type AbilityCode = keyof typeof ABILITY_CODE

export type AbilityOption = CoreMeta<AbilityCode>

export const ABILITIES: Record<AbilityCode, AbilityOption> = {
  [ABILITY_CODE.STRENGTH]: {
    code: ABILITY_CODE.STRENGTH,
    label: 'Strength',
    short: 'STR',
    description: 'Strength measures physical power, bodily force, and the ability to exert muscle.',
    tooltip: 'Physical power and force.'
  },
  [ABILITY_CODE.DEXTERITY]: {
    code: ABILITY_CODE.DEXTERITY,
    label: 'Dexterity',
    short: 'DEX',
    description: 'Dexterity measures agility, reflexes, balance, and precise control of movement.',
    tooltip: 'Agility and reflexes.'
  },
  [ABILITY_CODE.CONSTITUTION]: {
    code: ABILITY_CODE.CONSTITUTION,
    label: 'Constitution',
    short: 'CON',
    description: 'Constitution measures endurance, stamina, and overall bodily health.',
    tooltip: 'Endurance and vitality.'
  },
  [ABILITY_CODE.INTELLIGENCE]: {
    code: ABILITY_CODE.INTELLIGENCE,
    label: 'Intelligence',
    short: 'INT',
    description: 'Intelligence measures reasoning ability, memory, and analytical thinking.',
    tooltip: 'Reasoning and intellect.'
  },
  [ABILITY_CODE.WISDOM]: {
    code: ABILITY_CODE.WISDOM,
    label: 'Wisdom',
    short: 'WIS',
    description: 'Wisdom measures perception, intuition, awareness, and insight.',
    tooltip: 'Perception and intuition.'
  },
  [ABILITY_CODE.CHARISMA]: {
    code: ABILITY_CODE.CHARISMA,
    label: 'Charisma',
    short: 'CHA',
    description: 'Charisma measures confidence, presence, and the ability to influence others.',
    tooltip: 'Presence and influence.'
  },
  [ABILITY_CODE.SPELLCASTING]: {
    code: ABILITY_CODE.SPELLCASTING,
    label: 'Spellcasting',
    description: 'Spellcasting is the spellcasting ability determined for the spellcasting class.',
    tooltip: 'Spellcasting ability.'
  }
} as const

export const ABILITY_OPTIONS = valuesOf(ABILITIES) as readonly AbilityOption[]
