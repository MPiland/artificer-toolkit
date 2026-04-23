import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const SPELL_ATTRIBUTE = {
  CONCENTRATION: 'CONCENTRATION',
  RITUAL: 'RITUAL',
  ADDS_TO_WEAPON_ATTACK: 'ADDS_TO_WEAPON_ATTACK'
} as const

export type SpellAttribute = keyof typeof SPELL_ATTRIBUTE

export type SpellAttributeOption = CoreMeta<SpellAttribute>

export const SPELL_ATTRIBUTE_REGISTRY: Record<
  SpellAttribute,
  SpellAttributeOption
> = {
  CONCENTRATION: {
    code: SPELL_ATTRIBUTE.CONCENTRATION,
    label: 'Concentration',
    tooltip:
      'The spell requires concentration to maintain the spell which ends if the caster is incapacitated or dies.',
    description: 'The spell requires concentration.'
  },

  RITUAL: {
    code: SPELL_ATTRIBUTE.RITUAL,
    label: 'Ritual',
    tooltip:
      'The spell requires a ritual to cast which requires the character to remain casting for a longer time.',
    description: 'The spell requires a ritual to cast.'
  },

  ADDS_TO_WEAPON_ATTACK: {
    code: SPELL_ATTRIBUTE.ADDS_TO_WEAPON_ATTACK,
    label: 'Adds to Weapon Attack',
    tooltip:
      'The spell adds to the weapon attack.',
    description: 'The spell adds to the weapon attack.'
  }
} as const

export const SPELL_ATTRIBUTE_OPTIONS = valuesOf(
  SPELL_ATTRIBUTE_REGISTRY
) as readonly SpellAttributeOption[]

export const SPELL_COMPONENT = {
  VERBAL: 'VERBAL',
  SOMATIC: 'SOMATIC',
  MATERIAL: 'MATERIAL'
} as const

export type SpellComponent = keyof typeof SPELL_COMPONENT

export type SpellComponentOption = CoreMeta<SpellComponent>

export const SPELL_COMPONENT_REGISTRY: Record<
  SpellComponent,
  SpellComponentOption
> = {
  VERBAL: {
    code: SPELL_COMPONENT.VERBAL,
    label: 'Verbal',
    tooltip: 'The spell requires spoken words as part of casting.',
    description: 'The spell requires a verbal component.'
  },
  SOMATIC: {
    code: SPELL_COMPONENT.SOMATIC,
    label: 'Somatic',
    tooltip: 'The spell requires gestures or hand movements to cast.',
    description: 'The spell requires a somatic component.'
  },
  MATERIAL: {
    code: SPELL_COMPONENT.MATERIAL,
    label: 'Material',
    tooltip: 'The spell requires one or more physical materials to cast.',
    description: 'The spell requires a material component.'
  }
} as const

export const SPELL_COMPONENT_OPTIONS = valuesOf(
  SPELL_COMPONENT_REGISTRY
) as readonly SpellComponentOption[]

export const CASTING_TIME_UNIT_CODE = {
  ROUND: 'ROUND',
  MINUTE: 'MINUTE',
  HOUR: 'HOUR'
} as const

export type CastingTimeUnitCode = keyof typeof CASTING_TIME_UNIT_CODE

export type CastingTimeUnitOption = CoreMeta<CastingTimeUnitCode>

export const CASTING_TIME_UNIT_REGISTRY: Record<
  CastingTimeUnitCode,
  CastingTimeUnitOption
> = {
  [CASTING_TIME_UNIT_CODE.ROUND]: {
    code: CASTING_TIME_UNIT_CODE.ROUND,
    label: 'Round',
    description: 'Measured in combat rounds (6 seconds each).',
    tooltip: '6 seconds per round.'
  },
  [CASTING_TIME_UNIT_CODE.MINUTE]: {
    code: CASTING_TIME_UNIT_CODE.MINUTE,
    label: 'Minute',
    description: 'Measured in minutes of continuous casting.',
    tooltip: '10 rounds per minute.'
  },
  [CASTING_TIME_UNIT_CODE.HOUR]: {
    code: CASTING_TIME_UNIT_CODE.HOUR,
    label: 'Hour',
    description: 'Measured in hours of uninterrupted casting.',
    tooltip: 'Long-form ritual casting.'
  }
}

export const CASTING_TIME_UNIT_OPTIONS = valuesOf(
  CASTING_TIME_UNIT_REGISTRY
) as readonly CastingTimeUnitOption[]

// FOR FUTURE USE WHEN NEEDING RUNTIME CHECKING

export const CONCENTRATION_TYPE_CODE = {
  NONE: 'NONE',
  AFTER_CASTING: 'AFTER_CASTING',
  DURING_CASTING: 'DURING_CASTING'
} as const

export type ConcentrationTypeCode = keyof typeof CONCENTRATION_TYPE_CODE

export type ConcentrationTypeOption = CoreMeta<ConcentrationTypeCode>

export const CONCENTRATION_TYPE_REGISTRY: Record<
  ConcentrationTypeCode,
  ConcentrationTypeOption
> = {
  [CONCENTRATION_TYPE_CODE.NONE]: {
    code: CONCENTRATION_TYPE_CODE.NONE,
    label: 'No Concentration',
    description: 'This spell does not require concentration at any point.',
    tooltip: 'No concentration required.'
  },
  [CONCENTRATION_TYPE_CODE.DURING_CASTING]: {
    code: CONCENTRATION_TYPE_CODE.DURING_CASTING,
    label: 'During Casting',
    description:
      'Concentration must be maintained while the spell is being cast. If concentration is broken, casting fails.',
    tooltip: 'Concentration required while casting.'
  },
  [CONCENTRATION_TYPE_CODE.AFTER_CASTING]: {
    code: CONCENTRATION_TYPE_CODE.AFTER_CASTING,
    label: 'After Casting',
    description:
      'Concentration must be maintained after the spell is cast to sustain its effects.',
    tooltip: 'Concentration required to sustain effects.'
  }
} as const

export const CONCENTRATION_TYPE_OPTIONS = valuesOf(
  CONCENTRATION_TYPE_REGISTRY
) as readonly ConcentrationTypeOption[]
