import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

// How scaling is determined
export const SCALING_SOURCE = {
  CHARACTER_LEVEL: 'CHARACTER_LEVEL',
  CLASS_LEVEL: 'CLASS_LEVEL',
  SPELL_LEVEL: 'SPELL_LEVEL'
} as const

export type ScalingSource = keyof typeof SCALING_SOURCE

export type ScalingSourceOption = CoreMeta<ScalingSource>

export const SCALING_SOURCE_REGISTRY: Record<
  ScalingSource,
  ScalingSourceOption
> = {
  [SCALING_SOURCE.CHARACTER_LEVEL]: {
    code: SCALING_SOURCE.CHARACTER_LEVEL,
    label: 'Character Level',
    tooltip: 'Character level as source.',
    description: 'The level scaling is based on the character level.'
  },

  [SCALING_SOURCE.CLASS_LEVEL]: {
    code: SCALING_SOURCE.CLASS_LEVEL,
    label: 'Class Level',
    tooltip: 'Class level as source.',
    description: 'The level scaling is based on the class level.'
  },

  [SCALING_SOURCE.SPELL_LEVEL]: {
    code: SCALING_SOURCE.SPELL_LEVEL,
    label: 'Spell Level',
    tooltip: 'Spell level as source.',
    description: 'The level scaling is based on the spell level.'
  }
} as const

export const SCALING_SOURCE_OPTIONS = valuesOf(SCALING_SOURCE_REGISTRY) as readonly ScalingSourceOption[]

export type ScalingSourcePayload = {
  [SCALING_SOURCE.CHARACTER_LEVEL]: {
    scalingSource: typeof SCALING_SOURCE.CHARACTER_LEVEL
  }
  [SCALING_SOURCE.CLASS_LEVEL]: {
    scalingSource: typeof SCALING_SOURCE.CLASS_LEVEL
    classId: string
  }
  [SCALING_SOURCE.SPELL_LEVEL]: {
    scalingSource: typeof SCALING_SOURCE.SPELL_LEVEL
    spellId: string
  }
}

export type ScalingPayload<K extends keyof ScalingSourcePayload> = ScalingSourcePayload[K]

export const SCALING = {
  NONE: 'NONE',
  PER_LEVEL: 'PER_LEVEL'
} as const

export type ScalingKind = keyof typeof SCALING

export type ScalingOption = CoreMeta<ScalingKind>

export const SCALING_REGISTRY: Record<
  ScalingKind,
  ScalingOption
> = {
  NONE: {
    code: SCALING.NONE,
    label: 'No Scaling',
    tooltip: 'This does not change at source levels.',
    description:
      'The content remains the same regardless of source level.'
  },

  PER_LEVEL: {
    code: SCALING.PER_LEVEL,
    label: 'Scales by Level',
    tooltip: 'This changes based on source level.',
    description:
      'The content varies dependent on the source level, using level-based rules.'
  }
} as const

export const SCALING_OPTIONS = valuesOf(SCALING_REGISTRY) as readonly ScalingOption[]

export type ScalingSourceAuthored = ScalingSourcePayload[keyof ScalingSourcePayload]

export const SCALING_AMOUNT_KIND = {
  FULL: 'FULL',
  HALF: 'HALF',
  DOUBLE: 'DOUBLE'
} as const

export type ScalingAmountKind = keyof typeof SCALING_AMOUNT_KIND

export type ScalingAmountOption = CoreMeta<ScalingAmountKind>

export const SCALING_AMOUNT_REGISTRY: Record<
  ScalingAmountKind,
  ScalingAmountOption
> = {
  [SCALING_AMOUNT_KIND.FULL]: {
    code: SCALING_AMOUNT_KIND.FULL,
    label: 'Full',
    tooltip: 'Uses the full value.',
    description: 'Applies the value without modification.'
  },

  [SCALING_AMOUNT_KIND.HALF]: {
    code: SCALING_AMOUNT_KIND.HALF,
    label: 'Half',
    tooltip: 'Uses half the value.',
    description: 'Applies half of the original value.'
  },

  [SCALING_AMOUNT_KIND.DOUBLE]: {
    code: SCALING_AMOUNT_KIND.DOUBLE,
    label: 'Double',
    tooltip: 'Uses double the value.',
    description: 'Applies twice the original value.'
  }
} as const

export const SCALING_AMOUNT_OPTIONS = valuesOf(SCALING_AMOUNT_REGISTRY)
