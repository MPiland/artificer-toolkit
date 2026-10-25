import type { LengthUnitCode } from '../core/measurement.js'
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

export interface CharacterSheetAdjustmentMetadata {
  id: string
  characterId: string
  sourceNote?: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

type AbilityAdjustmentValue =
  | {
      family: 'ABILITY'
      ability: string
      field: 'OTHER_MODIFIER' | 'SCORE_OVERRIDE'
      value: number
    }
  | {
      family: 'SAVING_THROW'
      ability: string
      field: 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE'
      value: number
    }
  | {
      family: 'SAVING_THROW'
      ability: string
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
      value: string
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
      value: { amount: number; unit: LengthUnitCode }
    }
  | {
      family: 'MOVEMENT'
      speedId: string
      field: 'SPEED_OVERRIDE'
      value: { amount: number; unit: LengthUnitCode }
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
      field:
        | 'ATTACK_BONUS'
        | 'ATTACK_OVERRIDE'
        | 'COST_OVERRIDE'
        | 'DAMAGE_BONUS'
        | 'WEIGHT_OVERRIDE'
      value: number
    }
  | {
      family: 'ITEM'
      itemInstanceId: string
      field: 'ADAMANTINE' | 'DISPLAY_AS_ATTACK' | 'DUAL_WIELD' | 'SILVERED'
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
      value: string
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

/**
 * Mechanical adjustment input accepted by the pure engine.
 *
 * Sheet labels, notes, actors, ownership, and timestamps are deliberately
 * absent. Application services must use `toCharacterMechanicalAdjustment`
 * rather than passing persisted adjustment records into a snapshot.
 */
type WithMechanicalAdjustmentId<T> = T extends CharacterSheetAdjustmentValue
  ? T & { id: string }
  : never

export type CharacterMechanicalAdjustment =
  WithMechanicalAdjustmentId<CharacterSheetAdjustmentValue>

export function toCharacterMechanicalAdjustment(
  adjustment: CharacterSheetAdjustment
): CharacterMechanicalAdjustment {
  switch (adjustment.family) {
    case 'ABILITY':
      return {
        id: adjustment.id,
        family: adjustment.family,
        ability: adjustment.ability,
        field: adjustment.field,
        value: adjustment.value
      }
    case 'SAVING_THROW':
      if (adjustment.field === 'PROFICIENCY_OVERRIDE') {
        return {
          id: adjustment.id,
          family: adjustment.family,
          ability: adjustment.ability,
          field: adjustment.field,
          value: adjustment.value
        }
      }
      return {
        id: adjustment.id,
        family: adjustment.family,
        ability: adjustment.ability,
        field: adjustment.field,
        value: adjustment.value
      }
    case 'SKILL':
      switch (adjustment.field) {
        case 'GOVERNING_ABILITY_OVERRIDE':
          return {
            id: adjustment.id,
            family: adjustment.family,
            skillId: adjustment.skillId,
            field: adjustment.field,
            value: adjustment.value
          }
        case 'PROFICIENCY_OVERRIDE':
          return {
            id: adjustment.id,
            family: adjustment.family,
            skillId: adjustment.skillId,
            field: adjustment.field,
            value: adjustment.value
          }
        default:
          return {
            id: adjustment.id,
            family: adjustment.family,
            skillId: adjustment.skillId,
            field: adjustment.field,
            value: adjustment.value
          }
      }
    case 'PASSIVE':
      return {
        id: adjustment.id,
        family: adjustment.family,
        skillId: adjustment.skillId,
        field: adjustment.field,
        value: adjustment.value
      }
    case 'SENSE':
      return {
        id: adjustment.id,
        family: adjustment.family,
        senseId: adjustment.senseId,
        field: adjustment.field,
        value: adjustment.value
      }
    case 'MOVEMENT':
      return {
        id: adjustment.id,
        family: adjustment.family,
        speedId: adjustment.speedId,
        field: adjustment.field,
        value: adjustment.value
      }
    case 'HIT_POINTS':
      return {
        id: adjustment.id,
        family: adjustment.family,
        field: adjustment.field,
        value: adjustment.value
      }
    case 'SPELL':
      return {
        id: adjustment.id,
        family: adjustment.family,
        source: { ...adjustment.source },
        field: adjustment.field,
        value: adjustment.value
      }
    case 'ITEM':
      if (adjustment.value === true) {
        return {
          id: adjustment.id,
          family: adjustment.family,
          itemInstanceId: adjustment.itemInstanceId,
          field: adjustment.field,
          value: adjustment.value
        }
      }
      return {
        id: adjustment.id,
        family: adjustment.family,
        itemInstanceId: adjustment.itemInstanceId,
        field: adjustment.field,
        value: adjustment.value
      }
    case 'COMPANION':
      switch (adjustment.field) {
        case 'ALIGNMENT_OVERRIDE':
        case 'CREATURE_TYPE_OVERRIDE':
          return {
            id: adjustment.id,
            family: adjustment.family,
            companionInstanceId: adjustment.companionInstanceId,
            field: adjustment.field,
            value: adjustment.value
          }
        case 'SIZE_OVERRIDE':
          return {
            id: adjustment.id,
            family: adjustment.family,
            companionInstanceId: adjustment.companionInstanceId,
            field: adjustment.field,
            value: adjustment.value
          }
        default:
          return {
            id: adjustment.id,
            family: adjustment.family,
            companionInstanceId: adjustment.companionInstanceId,
            field: adjustment.field,
            value: adjustment.value
          }
      }
    case 'DEFENSE':
      return {
        id: adjustment.id,
        family: adjustment.family,
        defenseKind: adjustment.defenseKind,
        damageTypeId: adjustment.damageTypeId,
        field: adjustment.field,
        value: adjustment.value
      }
    case 'PROFICIENCY':
      return {
        id: adjustment.id,
        family: adjustment.family,
        proficiencyKind: adjustment.proficiencyKind,
        targetId: adjustment.targetId,
        field: adjustment.field,
        value: adjustment.value
      }
  }
}

export type CharacterSheetAdjustmentWrite = CharacterSheetAdjustmentValue & {
  id: string
  characterId: string
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
