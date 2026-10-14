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

export const PROFICIENCY_KIND_REGISTRY: Record<ProficiencyKind, ProficiencyTypeOption> = {
  [PROFICIENCY_KIND.SKILL]: {
    code: PROFICIENCY_KIND.SKILL,
    label: 'Skill Proficiency',
    description: 'Grants proficiency in one or more skills.'
  },

  [PROFICIENCY_KIND.SAVE_ABILITY]: {
    code: PROFICIENCY_KIND.SAVE_ABILITY,
    label: 'Saving Throw Proficiency',
    description: 'Grants proficiency in one or more saving throw abilities.'
  },

  [PROFICIENCY_KIND.EQUIPMENT]: {
    code: PROFICIENCY_KIND.EQUIPMENT,
    label: 'Equipment Proficiency',
    description: 'Grants proficiency with specific equipment or equipment categories.'
  },

  [PROFICIENCY_KIND.EQUIPMENT_PROPERTY]: {
    code: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
    label: 'Equipment Property Proficiency',
    description:
      'Grants proficiency with equipment matching properties (optionally scoped by category).'
  },

  [PROFICIENCY_KIND.LANGUAGE]: {
    code: PROFICIENCY_KIND.LANGUAGE,
    label: 'Language Proficiency',
    description: 'Grants proficiency in one or more languages.'
  }
} as const

export const PROFICIENCY_KIND_OPTIONS = valuesOf(
  PROFICIENCY_KIND_REGISTRY
) as readonly ProficiencyTypeOption[]
