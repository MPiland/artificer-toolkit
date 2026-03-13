import type { CoreMeta } from './core.js'
import { valuesOf } from '#utils'

export const TRIGGER = {
  MELEE_WEAPON_ATTACK: 'MELEE_WEAPON_ATTACK',
  RANGED_WEAPON_ATTACK: 'RANGED_WEAPON_ATTACK',
  UNARMED_ATTACK: 'UNARMED_ATTACK',
  SPELL_ATTACK: 'SPELL_ATTACK',
  SAVING_THROW: 'SAVING_THROW',
  ENTER_AREA: 'ENTER_AREA'
} as const

export type Trigger = keyof typeof TRIGGER

export type TriggerOption = CoreMeta<Trigger>

export const TRIGGER_REGISTRY: Record<Trigger, TriggerOption> = {
  MELEE_WEAPON_ATTACK: {
    code: TRIGGER.MELEE_WEAPON_ATTACK,
    label: 'Melee Weapon Attack',
    description: 'Indicates a melee weapon attack against a target.',
    tooltip: 'Attack action trigger.'
  },

  RANGED_WEAPON_ATTACK: {
    code: TRIGGER.RANGED_WEAPON_ATTACK,
    label: 'Ranged Weapon Attack',
    description: 'Indicates a ranged weapon attack against a target.',
    tooltip: 'Attack action trigger.'
  },

  UNARMED_ATTACK: {
    code: TRIGGER.UNARMED_ATTACK,
    label: 'Unarmed Attack',
    description: 'Indicates an attack made without a weapon, using the creature’s body or natural weapons.',
    tooltip: 'Unarmed attack.'
  },

  SPELL_ATTACK: {
    code: TRIGGER.SPELL_ATTACK,
    label: 'Spell Attack',
    description: 'Indicates a spell attack roll made against a target.',
    tooltip: 'Spell attack roll.'

  },

  SAVING_THROW: {
    code: TRIGGER.SAVING_THROW,
    label: 'Saving Throw',
    description: 'The target of this effect is required to attempt a saving throw.',
    tooltip: 'Target rolls saving throw.'
  },

  ENTER_AREA: {
    code: TRIGGER.ENTER_AREA,
    label: 'Enter area',
    description: 'Indicates that the trigger is when the target enters the area.',
    tooltip: 'Triggers when target enters area.'
  }
}

export const TRIGGER_OPTIONS = valuesOf(TRIGGER_REGISTRY) as TriggerOption[]
