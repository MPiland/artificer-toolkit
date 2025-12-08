import type { Feature } from './features'
import type { Actions, ArmorClass, Damage, SaveDc, Speed } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
CREATURE TYPE — BASE ENTITY FOR ALL BEINGS (NPCs, MONSTERS, MOUNTS, ETC.)
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Represents any living (or animated) entity that has hit points, abilities,
and can participate in combat or encounters — including monsters, mounts,
and humanoid NPCs. This acts as the base type they all extend.

Structure:
----------
• `abilities` — Six core ability scores (STR, DEX, CON, INT, WIS, CHA).
• `armorClass` — Total AC, can include notes (e.g. “natural armor”).
• `hitPoints` — Base HP value and dice formula.
• `speeds` — Walk, fly, swim, etc., each with a value and unit.
• `senses` — References to system-defined senses (e.g. Darkvision 60 ft.).
• `languages` — Known languages.
• `proficiencies` — Skills and saves with modifiers.
• `traits` — Descriptive traits like size, alignment, or creature type.
• `actions`, `reactions`, `legendaryActions` — Lists of combat options.
• `features` — Non-combat traits that apply mechanically (e.g. Pack Tactics).
• `userId`, `systemId`, `masterId` — Ownership and system linkage.
──────────────────────────────────────────────────────────────────────────────
*/
export interface Creature {
  id: string
  label: string
  description: string | null
  quote: string
  traits: CreatureTraits
  abilities: [CreatureAbilities]
  armorClass: ArmorClass
  hitPoints: CreatureHitPoints
  speeds: Speed[]
  senses: string[] // [SystemSense IDs]
  languages: string[] // [Language IDs]
  proficiencies: CreatureProficiency[]
  features: Feature[] | null
  actions: CreatureAction[]
  reactions: CreatureAction[]
  legendaryActions: CreatureAction[]
  userId: string
  systemId: string
}

/*
──────────────────────────────────────────────────────────────────────────────
SUPPORTING TYPES
──────────────────────────────────────────────────────────────────────────────
*/

export interface CreatureTraits {
  sizeId: string
  typeId: string
  alignmentId: string
}

export interface CreatureAbilities {
  abilityId: string
  amount: number
}

export interface CreatureHitPoints {
  average: number // int
  dieConfig: string // e.g. "6d8 + 12"
}

export interface CreatureProficiency {
  categoryId: string
  skillId: string
  saveAbilityId: string
  bonus: number // int
}

export interface CreatureAction {
  id: string
  label: string
  description: string | null
  actions: Actions
  damage: Damage
  saveDc: SaveDc
}
