import type { AbilityCode } from '../core/ability.js'
import type { SizeCode } from '../core/size.js'
import type { CharacterSpellSourceRef } from './sheetResource.js'

export const CHARACTER_PROFICIENCY_LEVEL = {
  DOUBLE: 'DOUBLE',
  FULL: 'FULL',
  HALF: 'HALF',
  NONE: 'NONE'
} as const

export type CharacterProficiencyLevel =
  (typeof CHARACTER_PROFICIENCY_LEVEL)[keyof typeof CHARACTER_PROFICIENCY_LEVEL]

export const CHARACTER_SHEET_ADJUSTMENT_FAMILY = {
  ABILITY: 'ABILITY',
  COMPANION: 'COMPANION',
  DEFENSE: 'DEFENSE',
  HIT_POINTS: 'HIT_POINTS',
  ITEM: 'ITEM',
  MOVEMENT: 'MOVEMENT',
  PASSIVE: 'PASSIVE',
  PROFICIENCY: 'PROFICIENCY',
  SAVING_THROW: 'SAVING_THROW',
  SENSE: 'SENSE',
  SKILL: 'SKILL',
  SPELL: 'SPELL'
} as const

export type CharacterSheetAdjustmentFamily =
  (typeof CHARACTER_SHEET_ADJUSTMENT_FAMILY)[keyof typeof CHARACTER_SHEET_ADJUSTMENT_FAMILY]

export const CHARACTER_DEFENSE_KIND = {
  IMMUNITY: 'IMMUNITY',
  RESISTANCE: 'RESISTANCE',
  VULNERABILITY: 'VULNERABILITY'
} as const

export type CharacterDefenseKind =
  (typeof CHARACTER_DEFENSE_KIND)[keyof typeof CHARACTER_DEFENSE_KIND]

export const CHARACTER_PROFICIENCY_TARGET_KIND = {
  ARMOR: 'ARMOR',
  LANGUAGE: 'LANGUAGE',
  TOOL: 'TOOL',
  WEAPON: 'WEAPON'
} as const

export type CharacterProficiencyTargetKind =
  (typeof CHARACTER_PROFICIENCY_TARGET_KIND)[keyof typeof CHARACTER_PROFICIENCY_TARGET_KIND]

export const CHARACTER_MOVEMENT_DISPLAY_MODE = {
  AUTO: 'AUTO',
  EXPLICIT: 'EXPLICIT'
} as const

export type CharacterMovementDisplayPreference =
  | { mode: 'AUTO' }
  | { mode: 'EXPLICIT'; speedId: string }

export type CharacterSheetAdjustmentSourceCategory = 'MAGIC' | 'MANUAL' | 'MISCELLANEOUS' | 'OTHER'

export interface CharacterSheetAdjustmentMetadata {
  id: string
  characterId: string
  sourceCategory: CharacterSheetAdjustmentSourceCategory
  sourceLabel?: string
  sourceNote?: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

type AbilityAdjustmentValue =
  | {
      family: 'ABILITY'
      ability: AbilityCode
      field: 'OTHER_MODIFIER' | 'SCORE_OVERRIDE'
      value: number
    }
  | {
      family: 'SAVING_THROW'
      ability: AbilityCode
      field: 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE'
      value: number
    }
  | {
      family: 'SAVING_THROW'
      ability: AbilityCode
      field: 'PROFICIENCY_OVERRIDE'
      value: CharacterProficiencyLevel
    }

type SkillAdjustmentValue =
  | {
      family: 'SKILL'
      skillId: string
      field: 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE'
      value: number
    }
  | {
      family: 'SKILL'
      skillId: string
      field: 'PROFICIENCY_OVERRIDE'
      value: CharacterProficiencyLevel
    }
  | {
      family: 'SKILL'
      skillId: string
      field: 'GOVERNING_ABILITY_OVERRIDE'
      value: AbilityCode
    }

type NumericAdjustmentValue =
  | {
      family: 'PASSIVE'
      skillId: string
      field: 'TOTAL_OVERRIDE'
      value: number
    }
  | {
      family: 'SENSE'
      senseId: string
      field: 'RANGE_OVERRIDE'
      value: number
    }
  | {
      family: 'MOVEMENT'
      speedId: string
      field: 'SPEED_OVERRIDE'
      value: number
    }
  | {
      family: 'HIT_POINTS'
      field: 'MAXIMUM_MODIFIER' | 'MAXIMUM_OVERRIDE'
      value: number
    }

type SpellAdjustmentValue = {
  family: 'SPELL'
  source: CharacterSpellSourceRef
  field: 'ATTACK_BONUS' | 'ATTACK_OVERRIDE' | 'DAMAGE_BONUS' | 'DC_BONUS' | 'DC_OVERRIDE'
  value: number
}

type ItemAdjustmentValue =
  | {
      family: 'ITEM'
      itemInstanceId: string
      field: 'ATTACK_BONUS' | 'ATTACK_OVERRIDE' | 'DAMAGE_BONUS' | 'WEIGHT_OVERRIDE'
      value: number
    }
  | {
      family: 'ITEM'
      itemInstanceId: string
      field: 'ADAMANTINE' | 'DUAL_WIELD' | 'SILVERED'
      value: true
    }

type CompanionAdjustmentValue =
  | {
      family: 'COMPANION'
      companionInstanceId: string
      field: 'ARMOR_CLASS_OVERRIDE' | 'MAXIMUM_HIT_POINTS_OVERRIDE'
      value: number
    }
  | {
      family: 'COMPANION'
      companionInstanceId: string
      field: 'ALIGNMENT_OVERRIDE' | 'CREATURE_TYPE_OVERRIDE'
      value: string
    }
  | {
      family: 'COMPANION'
      companionInstanceId: string
      field: 'SIZE_OVERRIDE'
      value: SizeCode
    }

type AdditionAdjustmentValue =
  | {
      family: 'DEFENSE'
      defenseKind: CharacterDefenseKind
      damageTypeId: string
      field: 'ADDITION'
      value: true
    }
  | {
      family: 'PROFICIENCY'
      proficiencyKind: CharacterProficiencyTargetKind
      targetId: string
      field: 'ADDITION'
      value: true
    }

export type CharacterSheetAdjustmentValue =
  | AbilityAdjustmentValue
  | SkillAdjustmentValue
  | NumericAdjustmentValue
  | SpellAdjustmentValue
  | ItemAdjustmentValue
  | CompanionAdjustmentValue
  | AdditionAdjustmentValue

export type CharacterSheetAdjustment = CharacterSheetAdjustmentMetadata &
  CharacterSheetAdjustmentValue

export type CharacterSheetAdjustmentWrite = CharacterSheetAdjustmentValue & {
  id: string
  characterId: string
  sourceCategory?: CharacterSheetAdjustmentSourceCategory
  sourceLabel?: string
  sourceNote?: string
  actorId: string
}

export type CharacterSheetCustomization =
  | {
      family: 'SPELL'
      source: CharacterSpellSourceRef
      customName?: string
      notes?: string
      displayAsAttack?: boolean
    }
  | {
      family: 'ITEM'
      itemInstanceId: string
      costOverride?: number
      customName?: string
      notes?: string
      displayAsAttack?: boolean
    }
  | {
      family: 'COMPANION'
      companionInstanceId: string
      customName?: string
      notes?: string
    }
