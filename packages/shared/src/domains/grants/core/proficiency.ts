import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const PROFICIENCY_KIND = {
  SKILL: 'SKILL',
  SAVE_ABILITY: 'SAVE_ABILITY',
  EQUIPMENT: 'EQUIPMENT',
  EQUIPMENT_PROPERTY: 'EQUIPMENT_PROPERTY',
  LANGUAGE: 'LANGUAGE'
} as const

export type ProficiencyKind = keyof typeof PROFICIENCY_KIND

export type ProficiencyTypeOption = CoreMeta<ProficiencyKind>

export const PROFICIENCY_KIND_REGISTRY: Record<
  ProficiencyKind,
  ProficiencyTypeOption
> = {
  [PROFICIENCY_KIND.SKILL]: {
    code: PROFICIENCY_KIND.SKILL,
    label: 'Skill Proficiency',
    tooltip: 'Grants proficiency in one or more skills.',
    description:
      'Targets skills (e.g., Stealth, Perception). Use grant mode/type to choose or grant.'
  },

  [PROFICIENCY_KIND.SAVE_ABILITY]: {
    code: PROFICIENCY_KIND.SAVE_ABILITY,
    label: 'Saving Throw Proficiency',
    tooltip: 'Grants proficiency in one or more saving throw abilities.',
    description:
      'Targets saving throw abilities (e.g., Constitution saves).'
  },

  [PROFICIENCY_KIND.EQUIPMENT]: {
    code: PROFICIENCY_KIND.EQUIPMENT,
    label: 'Equipment Proficiency',
    tooltip: 'Grants proficiency with specific equipment or equipment categories.',
    description:
      'Targets equipment IDs and/or equipment categories (e.g., “Longsword” or “Martial Weapons”).'
  },

  [PROFICIENCY_KIND.EQUIPMENT_PROPERTY]: {
    code: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
    label: 'Equipment Property Proficiency',
    tooltip: 'Grants proficiency with equipment matching properties (optionally scoped by category).',
    description:
      'Targets equipment properties (e.g., “Heavy”) and optionally a category (e.g., “Armor”).'
  },

  [PROFICIENCY_KIND.LANGUAGE]: {
    code: PROFICIENCY_KIND.LANGUAGE,
    label: 'Language Proficiency',
    tooltip: 'Grants proficiency in one or more languages.',
    description:
      'Targets language IDs (e.g., Common, Elvish).'
  }
} as const

export const PROFICIENCY_KIND_OPTIONS = valuesOf(
  PROFICIENCY_KIND_REGISTRY
) as readonly ProficiencyTypeOption[]
