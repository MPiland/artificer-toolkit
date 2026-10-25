import type {
  AbilityCode,
  AttackDomainCode,
  EquipmentCategoryCode,
  LengthUnitCode,
  MeasurementUnitCode,
  SpellGrantAttribute
} from '@artificer-toolkit/shared/core'
import type {
  CharacterCalculation,
  CharacterMechanicSourceRef,
  CharacterProficiencyLevel,
  CharacterSpellSourceRef,
  ContentRef
} from '@artificer-toolkit/shared/character'
import type { CompiledChargeUse } from '@artificer-toolkit/shared/compilers'
import type { SenseRangeDto } from '@artificer-toolkit/schema/grants/sense'
import type { OfferedRollModeDto } from '@artificer-toolkit/schema/shared/systemCoreCode'
import type { CharacterClassState } from '@artificer-toolkit/shared/subjects/authored'

/** Sheet-facing presentation data rehydrated from one validated Character rule-policy result. */
type CharacterRuleRollMode = string

export interface CharacterRuleRollModes {
  initiative: CharacterRuleRollMode
  abilityChecks: Record<AbilityCode, CharacterRuleRollMode>
  savingThrows: Record<AbilityCode, CharacterRuleRollMode>
  skillChecks: Record<string, CharacterRuleRollMode>
  attacks: Record<AttackDomainCode, CharacterRuleRollMode>
}

export interface CharacterRuleProficiency {
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

export interface CharacterRuleSense {
  senseDefinitionId: string
  range: SenseRangeDto
}

export interface CharacterRuleDefense {
  kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
  damageTypeId: string
  source?: CharacterMechanicSourceRef
}

interface CharacterRuleMovementSpeed {
  speedId: string
  amount: number
  unit: LengthUnitCode
}

export interface CharacterRuleDerivedStats {
  proficiencyBonus: number
  /** Ability code -> final score (after modifiers applied) */
  abilityScores: Record<string, number>
  /** Ability code -> modifier value, e.g. STR 16 -> 3 */
  abilityModifiers: Record<string, number>
  /** Ability code -> total saving throw bonus */
  savingThrows: Record<string, number>
  /** Skill id -> total skill check bonus */
  skillBonuses: Record<string, number>
  skillGoverningAbilities: Record<string, string>
  passiveChecks: Record<string, number>
  movementSpeeds: CharacterRuleMovementSpeed[]
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

export interface CharacterRuleCalculationBreakdowns {
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

export interface CharacterRuleSpellMechanics {
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

/** A resolved spell-grant access path, including casting metadata and provenance. */
export interface CharacterRuleSpellAccess {
  /** Stable identity for this specific source/grant/spell access. */
  id: string
  spellId: string
  source:
    | { kind: 'CLASS'; classId: string }
    | { kind: 'SUBCLASS'; subclassId: string }
    | { kind: 'RACE'; raceId: string }
    | { kind: 'SUBRACE'; subraceId: string }
    | { kind: 'FEAT'; featId: string }
    | { kind: 'BACKGROUND'; backgroundId: string }
    | { kind: 'OPTION'; acquiredParentId: string; optionId: string }
  timing:
    | {
        kind: 'CLASS_LEVEL'
        classId: string
        classLevel: number
      }
    | {
        kind: 'CHARACTER_LEVEL'
        level: number
      }
  sourceFeatureId: string
  grantId: string
  /** Deterministic identity for the granting source before its target spell is applied. */
  sourceInstanceId: string
  attributes?: SpellGrantAttribute[]
  castAtLevel?: number
  castingAbility?: AbilityCode
  charges?: CompiledChargeUse
}

export interface CharacterRuleItemMechanics {
  itemInstanceId: string
  attackBonus: number
  cost?: number
  damageBonus: number
  displayAsAttack: boolean
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
    cost?: CharacterCalculation<number>
    damageBonus: CharacterCalculation<number>
    weight?: CharacterCalculation<number>
  }
}

export interface CharacterRuleCompanionStats {
  companionInstanceId: string
  creatureId: string
  abilityScores: Record<string, number>
  armorClass: number
  maxHitPoints: number
  size?: string
  alignmentId?: string
  creatureTypeId?: string
  calculations: {
    armorClass: CharacterCalculation<number>
    maxHitPoints: CharacterCalculation<number>
    size?: CharacterCalculation<string>
    alignmentId?: CharacterCalculation<string>
    creatureTypeId?: CharacterCalculation<string>
  }
}

/**
 * Spell slot maximums for the character.
 *
 * Single-class: read directly from the class's compiled spellLimits at current level.
 * Multiclass: summed effective caster levels looked up in the fusion table.
 * A System slot pool (such as D&D's Pact Magic) is tracked separately in `slotPools`.
 */
export interface CharacterRuleSpellSlots {
  /** Slot level (1-9) -> maximum slots */
  maxByLevel: Record<number, number>
  /** Each System slot pool the Character casts from beside its standard slots. */
  slotPools: { poolCode: string; slots: number; level: number }[]
  /** How slots were computed */
  fusionStrategy: 'NONE' | 'SINGLE_CLASS' | 'MULTICLASS_FUSED'
}

/**
 * A class resource (Rage, Ki, Channel Divinity, Bardic Inspiration, etc.)
 * with its resolved maximum at the current character level.
 */
export interface CharacterRuleResource {
  /** Matches the authored ChargeLimit id */
  resourceId: string
  /** Display name from authored content */
  label: string
  /** Resolved maximum count at current level */
  maxCount: number
  maxCountCalculation: CharacterCalculation<number>
  rechargeOn: 'SHORT_REST' | 'LONG_REST' | 'DAWN' | 'DUSK' | 'DAILY' | 'MANUAL'
  /** Which feature granted this resource */
  sourceFeatureId: string
}

/**
 * Tracks which equipped items contributed to derived stat resolution.
 * Used for UI provenance display (e.g. "AC 18: Plate Armor").
 */
export interface CharacterRuleItemContribution {
  instanceId: string
  contentRef: ContentRef
  /** Modifier domain keys this item contributed to (e.g. "ARMOR_CLASS:BONUS") */
  modifiersApplied: string[]
}

/** A feature use that spends charges owned by one active equipment instance. */
export interface CharacterRuleEquipmentFeatureChargeUse {
  featureId: string
  equipmentId: string
  itemInstanceId: string
  chargeId: string
  cost: number
}

export interface CharacterSheetRuleProjection {
  characterId: string
  systemId: string
  proficiencies: CharacterRuleProficiency[]
  senses: CharacterRuleSense[]
  defenses: CharacterRuleDefense[]
  derivedStats: CharacterRuleDerivedStats
  calculations: CharacterRuleCalculationBreakdowns
  rollModes: CharacterRuleRollModes
  /** The roll modes the System offers a roller, for the manual-roll controls. */
  offeredRollModes: OfferedRollModeDto[]
  /** Resolved class-scoped spell state derived from grants */
  spellState?: CharacterClassState[]
  /** Resolved spell-grant access paths derived during the same rule evaluation. */
  spellAccess: CharacterRuleSpellAccess[]
  /** Spell slot maximums; maxByLevel is empty when the character has no spellcasting. */
  spellSlots: CharacterRuleSpellSlots
  /** Class resources with resolved maximums */
  resources: CharacterRuleResource[]
  spellMechanics: CharacterRuleSpellMechanics[]
  itemMechanics: CharacterRuleItemMechanics[]
  companions: CharacterRuleCompanionStats[]
  /** Which equipped items contributed to derived stat resolution */
  activeItemContributions: CharacterRuleItemContribution[]
  /** Feature uses bound to charges owned by active equipment instances. */
  equipmentFeatureChargeUses: CharacterRuleEquipmentFeatureChargeUse[]
}
