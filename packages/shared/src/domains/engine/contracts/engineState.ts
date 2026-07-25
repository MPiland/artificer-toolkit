/**
 * Output types from the character engine.
 *
 * These are the derived statistics computed by `runEngine()` from a
 * `CharacterBuildSnapshot` + `CharacterAssemblyRegistry` + `RulesSystem`.
 */

import type { CompiledRange } from '../../shared/compilers/range.js'
import type { CompiledCharacterClassState } from '../../subjects/compilers/character/state.js'
import type { ContentRef } from '../snapshot.js'
import type { EquipmentCategoryCode } from '../../subjects/core/equipment.js'
import type {
  CharacterCalculation,
  CharacterMechanicSourceRef
} from '../../character/sheetCalculation.js'
import type { CharacterProficiencyLevel } from '../../character/sheetAdjustment.js'
import type { CharacterSpellSourceRef } from '../../character/sheetResource.js'
import type { MeasurementUnitCode } from '../../core/measurement.js'
import type { SizeCode } from '../../core/size.js'

export interface EngineProficiency {
  /** PROFICIENCY_KIND value (SKILL, SAVE_ABILITY, LANGUAGE, EQUIPMENT, EQUIPMENT_PROPERTY) */
  kind: string
  /** skillId / ability code / languageId / equipmentId depending on kind */
  subjectId: string
  /** Retains category scope for equipment-property proficiencies with overlapping property codes. */
  category?: EquipmentCategoryCode
  /** Proficiency scaling applied when computing bonuses */
  scaling: 'FULL' | 'HALF' | 'DOUBLE'
  /** Mechanical provenance for calculation breakdowns. */
  source?: CharacterMechanicSourceRef
  /** Stable authored grant identity when the proficiency came from content. */
  grantId?: string
}

export interface EngineSense {
  senseCode: string
  range?: CompiledRange
}

export interface EngineDefense {
  kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
  damageTypeId: string
  source?: CharacterMechanicSourceRef
}

export interface EngineMovementSpeed {
  speedId: string
  amount: number
  unit: MeasurementUnitCode
}

export interface EngineDerivedStats {
  proficiencyBonus: number
  /** Ability code â†’ final score (after modifiers applied) */
  abilityScores: Record<string, number>
  /** Ability code â†’ modifier value, e.g. STR 16 â†’ 3 */
  abilityModifiers: Record<string, number>
  /** Ability code â†’ total saving throw bonus */
  savingThrows: Record<string, number>
  /** Skill id â†’ total skill check bonus */
  skillBonuses: Record<string, number>
  skillGoverningAbilities: Record<string, string>
  passiveChecks: Record<string, number>
  movementSpeeds: EngineMovementSpeed[]
  primaryMovementSpeedId?: string
  initiative: number
  /** Resolved from equipped armor + shield + modifiers. Falls back to 10 + DEX when unarmored. */
  armorClass: number
  maxHitPoints: number
  /** Present only when character has a spellcasting class in the registry */
  spellSaveDC?: number
  /** Present only when character has a spellcasting class in the registry */
  spellAttackBonus?: number
}

export interface EngineCalculationBreakdowns {
  proficiencyBonus: CharacterCalculation<number>
  abilityScores: Record<string, CharacterCalculation<number>>
  abilityModifiers: Record<string, CharacterCalculation<number>>
  savingThrowProficiencyLevels: Record<string, CharacterCalculation<CharacterProficiencyLevel>>
  savingThrows: Record<string, CharacterCalculation<number>>
  skillGoverningAbilities: Record<string, CharacterCalculation<string>>
  skillProficiencyLevels: Record<string, CharacterCalculation<CharacterProficiencyLevel>>
  skillBonuses: Record<string, CharacterCalculation<number>>
  passiveChecks: Record<string, CharacterCalculation<number>>
  movementSpeeds: Record<string, CharacterCalculation<number>>
  senseRanges: Record<string, CharacterCalculation<number>>
  initiative: CharacterCalculation<number>
  armorClass: CharacterCalculation<number>
  maxHitPoints: CharacterCalculation<number>
  spellSaveDC?: CharacterCalculation<number>
  spellAttackBonus?: CharacterCalculation<number>
}

export interface EngineSpellMechanics {
  source: CharacterSpellSourceRef
  attackBonus?: number
  saveDC?: number
  damageBonus: number
  calculations: {
    attackBonus?: CharacterCalculation<number>
    saveDC?: CharacterCalculation<number>
    damageBonus: CharacterCalculation<number>
  }
}

export interface EngineItemMechanics {
  itemInstanceId: string
  attackBonus: number
  damageBonus: number
  properties: {
    adamantine: boolean
    dualWield: boolean
    silvered: boolean
  }
  weight?: {
    amount: number
    unit: MeasurementUnitCode
  }
  calculations: {
    attackBonus: CharacterCalculation<number>
    damageBonus: CharacterCalculation<number>
    weight?: CharacterCalculation<number>
  }
}

export interface EngineCompanionStats {
  companionInstanceId: string
  creatureId: string
  abilityScores: Record<string, number>
  armorClass: number
  maxHitPoints: number
  size?: SizeCode
  alignmentId?: string
  creatureTypeId?: string
  calculations: {
    armorClass: CharacterCalculation<number>
    maxHitPoints: CharacterCalculation<number>
    size?: CharacterCalculation<SizeCode>
    alignmentId?: CharacterCalculation<string>
    creatureTypeId?: CharacterCalculation<string>
  }
}

/**
 * Spell slot maximums for the character.
 *
 * Single-class: read directly from the class's compiled spellLimits at current level.
 * Multiclass: summed effective caster levels looked up in the fusion table.
 * Pact magic (Warlock): separate slot pool tracked in `pactMagic`.
 */
export interface EngineSpellSlots {
  /** Slot level (1â€“9) â†’ maximum slots */
  maxByLevel: Record<number, number>
  /** Pact magic tracked separately â€” not fused with standard slots */
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
  maxCountCalculation: CharacterCalculation<number>
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
  contentRef: ContentRef
  /** Modifier domain keys this item contributed to (e.g. "ARMOR_CLASS:BONUS") */
  modifiersApplied: string[]
}

export interface EngineCharacterOutput {
  characterId: string
  systemId: string
  proficiencies: EngineProficiency[]
  senses: EngineSense[]
  defenses: EngineDefense[]
  derivedStats: EngineDerivedStats
  calculations: EngineCalculationBreakdowns
  /** Resolved class-scoped spell state derived from grants */
  spellState?: CompiledCharacterClassState[]
  /** Spell slot maximums â€” empty maxByLevel when character has no spellcasting */
  spellSlots: EngineSpellSlots
  /** Class resources with resolved maximums */
  resources: EngineResource[]
  spellMechanics: EngineSpellMechanics[]
  itemMechanics: EngineItemMechanics[]
  companions: EngineCompanionStats[]
  /** Which equipped items contributed to derived stat resolution */
  activeItemContributions: EngineItemContribution[]
}
