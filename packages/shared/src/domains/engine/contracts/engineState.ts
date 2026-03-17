/**
 * Output types from the character engine.
 *
 * These are the derived statistics computed by `runEngine()` from a
 * `CharacterBuildSnapshot` + `CharacterAssemblyRegistry` + `RulesSystem`.
 */

export interface EngineProficiency {
  /** PROFICIENCY_KIND value (SKILL, SAVE_ABILITY, LANGUAGE, EQUIPMENT, EQUIPMENT_PROPERTY) */
  kind: string
  /** skillId / ability code / languageId / equipmentId depending on kind */
  subjectId: string
  /** Proficiency scaling applied when computing bonuses */
  scaling: 'FULL' | 'HALF' | 'DOUBLE'
}

export interface EngineSense {
  senseCode: string
  range?: number
}

export interface EngineDerivedStats {
  proficiencyBonus: number
  /** Ability code → final score (after modifiers applied) */
  abilityScores: Record<string, number>
  /** Ability code → modifier value, e.g. STR 16 → 3 */
  abilityModifiers: Record<string, number>
  /** Ability code → total saving throw bonus */
  savingThrows: Record<string, number>
  /** Skill id → total skill check bonus */
  skillBonuses: Record<string, number>
  initiative: number
  /** Resolved from equipped armor + shield + modifiers. Falls back to 10 + DEX when unarmored. */
  armorClass: number
  maxHitPoints: number
  /** Present only when character has a spellcasting class in the registry */
  spellSaveDC?: number
  /** Present only when character has a spellcasting class in the registry */
  spellAttackBonus?: number
}

/**
 * Spell slot maximums for the character.
 *
 * Single-class: read directly from the class's compiled spellLimits at current level.
 * Multiclass: summed effective caster levels looked up in the fusion table.
 * Pact magic (Warlock): separate slot pool tracked in `pactMagic`.
 */
export interface EngineSpellSlots {
  /** Slot level (1–9) → maximum slots */
  maxByLevel: Record<number, number>
  /** Pact magic tracked separately — not fused with standard slots */
  pactMagic?: {
    slots: number
    level: number
  }
  /** How slots were computed */
  fusionStrategy: 'NONE' | 'SINGLE_CLASS' | 'MULTICLASS_FUSED'
}

/**
 * A class resource (Rage, Ki, Channel Divinity, Bardic Inspiration, etc.)
 * with its resolved maximum at the current character level.
 */
export interface EngineResource {
  /** Matches the authored ChargeLimit id */
  resourceId: string
  /** Display name from authored content */
  label: string
  /** Resolved maximum count at current level */
  maxCount: number
  rechargeOn: 'SHORT_REST' | 'LONG_REST' | 'MANUAL'
  /** Which feature granted this resource */
  sourceFeatureId: string
}

/**
 * Tracks which equipped items contributed to derived stat resolution.
 * Used for UI provenance display (e.g. "AC 18: Plate Armor").
 */
export interface EngineItemContribution {
  instanceId: string
  contentId: string
  /** Modifier domain keys this item contributed to (e.g. "ARMOR_CLASS:BONUS") */
  modifiersApplied: string[]
}

export interface EngineCharacterOutput {
  characterId: string
  systemId: string
  proficiencies: EngineProficiency[]
  senses: EngineSense[]
  derivedStats: EngineDerivedStats
  /** Spell slot maximums — empty maxByLevel when character has no spellcasting */
  spellSlots: EngineSpellSlots
  /** Class resources with resolved maximums */
  resources: EngineResource[]
  /** Which equipped items contributed to derived stat resolution */
  activeItemContributions: EngineItemContribution[]
}
