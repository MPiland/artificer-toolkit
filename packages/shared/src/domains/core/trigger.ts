import type { CoreMeta } from './core.js'
import { valuesOf } from '#utils'

export const TRIGGER = {
  ACTIVATED: 'ACTIVATED',
  MELEE_WEAPON_ATTACK: 'MELEE_WEAPON_ATTACK',
  RANGED_WEAPON_ATTACK: 'RANGED_WEAPON_ATTACK',
  UNARMED_ATTACK: 'UNARMED_ATTACK',
  MELEE_SPELL_ATTACK: 'MELEE_SPELL_ATTACK',
  RANGED_SPELL_ATTACK: 'RANGED_SPELL_ATTACK',
  INCOMING_SAVING_THROW: 'INCOMING_SAVING_THROW',
  SAVING_THROW: 'SAVING_THROW',
  CHECK: 'CHECK',
  ENTER_AREA: 'ENTER_AREA',
  INCOMING_DAMAGE: 'INCOMING_DAMAGE',
  HP_ZERO: 'HP_ZERO',
  INCOMING_WEAPON_HIT: 'INCOMING_WEAPON_HIT'
} as const

export type Trigger = keyof typeof TRIGGER

export type TriggerOption = CoreMeta<Trigger>

export const TRIGGER_REGISTRY: Record<Trigger, TriggerOption> = {
  ACTIVATED: {
    code: TRIGGER.ACTIVATED,
    label: 'Activated',
    description: 'Activated effect.'
  },

  MELEE_WEAPON_ATTACK: {
    code: TRIGGER.MELEE_WEAPON_ATTACK,
    label: 'Melee Weapon Attack',
    description: 'Attack action trigger.'
  },

  RANGED_WEAPON_ATTACK: {
    code: TRIGGER.RANGED_WEAPON_ATTACK,
    label: 'Ranged Weapon Attack',
    description: 'Attack action trigger.'
  },

  UNARMED_ATTACK: {
    code: TRIGGER.UNARMED_ATTACK,
    label: 'Unarmed Attack',
    description: 'Unarmed attack.'
  },

  MELEE_SPELL_ATTACK: {
    code: TRIGGER.MELEE_SPELL_ATTACK,
    label: 'Melee Spell Attack',
    description: 'Melee spell attack roll.'
  },

  RANGED_SPELL_ATTACK: {
    code: TRIGGER.RANGED_SPELL_ATTACK,
    label: 'Ranged Spell Attack',
    description: 'Ranged spell attack roll.'
  },

  INCOMING_SAVING_THROW: {
    code: TRIGGER.INCOMING_SAVING_THROW,
    label: 'Incoming Saving Throw',
    description: 'Source makes a saving throw.'
  },

  SAVING_THROW: {
    code: TRIGGER.SAVING_THROW,
    label: 'Saving Throw',
    description: 'Target rolls saving throw.'
  },

  CHECK: {
    code: TRIGGER.CHECK,
    label: 'Check',
    description: 'Actor rolls a check.'
  },

  ENTER_AREA: {
    code: TRIGGER.ENTER_AREA,
    label: 'Enter area',
    description: 'Triggers when target enters area.'
  },

  INCOMING_DAMAGE: {
    code: TRIGGER.INCOMING_DAMAGE,
    label: 'Incoming damage',
    description: 'Triggers when the holder takes damage.'
  },

  HP_ZERO: {
    code: TRIGGER.HP_ZERO,
    label: 'Reduced to 0 hit points',
    description: 'Triggers when the holder is reduced to 0 hit points.'
  },

  INCOMING_WEAPON_HIT: {
    code: TRIGGER.INCOMING_WEAPON_HIT,
    label: 'Hit by a weapon',
    description: 'Triggers when a weapon attack hits the holder; acts on the weapon that hit.'
  }
}

export const TRIGGER_OPTIONS = valuesOf(TRIGGER_REGISTRY) as TriggerOption[]
