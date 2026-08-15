import {
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE
} from '@artificer-toolkit/shared/core'

import type { CharacterBuilderResolution } from './builderService.js'
import type { CharacterRuleProficiency } from './characterSheetRuleProjection.js'

export const CHARACTER_SHEET_PROFICIENCY_KINDS = ['ARMOR', 'LANGUAGE', 'TOOL', 'WEAPON'] as const

export type CharacterSheetProficiencyKind = (typeof CHARACTER_SHEET_PROFICIENCY_KINDS)[number]

const ARMOR_PROFICIENCY_PROPERTIES = new Set<string>([
  EQUIPMENT_PROPERTY_CODE.LIGHT,
  EQUIPMENT_PROPERTY_CODE.MEDIUM,
  EQUIPMENT_PROPERTY_CODE.HEAVY
])

const TOOL_PROFICIENCY_PROPERTIES = new Set<string>([
  EQUIPMENT_PROPERTY_CODE.ARTISANAL_TOOL,
  EQUIPMENT_PROPERTY_CODE.MUSICAL_INSTRUMENT,
  EQUIPMENT_PROPERTY_CODE.GAMING_SET,
  EQUIPMENT_PROPERTY_CODE.PROFESSIONAL_TOOL
])

const WEAPON_PROFICIENCY_PROPERTIES = new Set<string>([
  EQUIPMENT_PROPERTY_CODE.SIMPLE,
  EQUIPMENT_PROPERTY_CODE.MARTIAL,
  EQUIPMENT_PROPERTY_CODE.MELEE,
  EQUIPMENT_PROPERTY_CODE.RANGED
])

export function getProficiencyTargetKind(
  proficiency: CharacterRuleProficiency,
  resolution: CharacterBuilderResolution
): CharacterSheetProficiencyKind | undefined {
  if (proficiency.kind === 'LANGUAGE') return 'LANGUAGE'

  if (proficiency.kind === 'EQUIPMENT') {
    const category = resolution.catalog.equipment.find(
      (equipment) => equipment.id === proficiency.subjectId
    )?.category
    switch (category) {
      case EQUIPMENT_CATEGORY_CODE.ARMOR:
      case EQUIPMENT_CATEGORY_CODE.SHIELD:
        return 'ARMOR'
      case EQUIPMENT_CATEGORY_CODE.TOOL:
        return 'TOOL'
      case EQUIPMENT_CATEGORY_CODE.WEAPON:
        return 'WEAPON'
      default:
        return undefined
    }
  }

  if (proficiency.kind !== 'EQUIPMENT_PROPERTY') return undefined

  switch (proficiency.category) {
    case EQUIPMENT_CATEGORY_CODE.ARMOR:
      return ARMOR_PROFICIENCY_PROPERTIES.has(proficiency.subjectId) ? 'ARMOR' : undefined
    case EQUIPMENT_CATEGORY_CODE.TOOL:
      return TOOL_PROFICIENCY_PROPERTIES.has(proficiency.subjectId) ? 'TOOL' : undefined
    case EQUIPMENT_CATEGORY_CODE.WEAPON:
      return WEAPON_PROFICIENCY_PROPERTIES.has(proficiency.subjectId) ? 'WEAPON' : undefined
    default:
      return undefined
  }
}
