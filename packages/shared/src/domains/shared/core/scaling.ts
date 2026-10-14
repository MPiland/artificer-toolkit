import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

// How scaling is determined
export const SCALING_SOURCE = {
  CHARACTER_LEVEL: 'CHARACTER_LEVEL',
  CLASS_LEVEL: 'CLASS_LEVEL',
  PARENT_CLASS_LEVEL: 'PARENT_CLASS_LEVEL',
  SPELL_CAST_LEVEL: 'SPELL_CAST_LEVEL'
} as const

export type ScalingSource = keyof typeof SCALING_SOURCE

export type ScalingSourceOption = CoreMeta<ScalingSource>

export const SCALING_SOURCE_REGISTRY: Record<ScalingSource, ScalingSourceOption> = {
  [SCALING_SOURCE.CHARACTER_LEVEL]: {
    code: SCALING_SOURCE.CHARACTER_LEVEL,
    label: 'Character Level',
    description: 'Character level as source.'
  },

  [SCALING_SOURCE.CLASS_LEVEL]: {
    code: SCALING_SOURCE.CLASS_LEVEL,
    label: 'Class Level',
    description: 'Class level as source.'
  },

  [SCALING_SOURCE.PARENT_CLASS_LEVEL]: {
    code: SCALING_SOURCE.PARENT_CLASS_LEVEL,
    label: 'Parent Class Level',
    description: 'Owning class level as source.'
  },

  [SCALING_SOURCE.SPELL_CAST_LEVEL]: {
    code: SCALING_SOURCE.SPELL_CAST_LEVEL,
    label: 'Spell Cast Level',
    description: 'Actual cast level as source.'
  }
} as const

export const SCALING_SOURCE_OPTIONS = valuesOf(
  SCALING_SOURCE_REGISTRY
) as readonly ScalingSourceOption[]

export type ScalingSourcePayload = {
  [SCALING_SOURCE.CHARACTER_LEVEL]: {
    scalingSource: typeof SCALING_SOURCE.CHARACTER_LEVEL
  }
  [SCALING_SOURCE.CLASS_LEVEL]: {
    scalingSource: typeof SCALING_SOURCE.CLASS_LEVEL
    classId: string
  }
  [SCALING_SOURCE.PARENT_CLASS_LEVEL]: {
    scalingSource: typeof SCALING_SOURCE.PARENT_CLASS_LEVEL
  }
  [SCALING_SOURCE.SPELL_CAST_LEVEL]: {
    scalingSource: typeof SCALING_SOURCE.SPELL_CAST_LEVEL
  }
}

export type ScalingPayload<K extends keyof ScalingSourcePayload> = ScalingSourcePayload[K]

export const SCALING = {
  NONE: 'NONE',
  PER_LEVEL: 'PER_LEVEL'
} as const

export type ScalingKind = keyof typeof SCALING

export type ScalingOption = CoreMeta<ScalingKind>

export const SCALING_REGISTRY: Record<ScalingKind, ScalingOption> = {
  NONE: {
    code: SCALING.NONE,
    label: 'No Scaling',
    description: 'This does not change at source levels.'
  },

  PER_LEVEL: {
    code: SCALING.PER_LEVEL,
    label: 'Scales by Level',
    description: 'This changes based on source level.'
  }
} as const

export const SCALING_OPTIONS = valuesOf(SCALING_REGISTRY) as readonly ScalingOption[]

export type ScalingSourceAuthored = ScalingSourcePayload[keyof ScalingSourcePayload]

export const SCALABLE_SCALING_KIND = {
  BREAKPOINTS: 'BREAKPOINTS'
} as const

export type ScalableScalingKind = keyof typeof SCALABLE_SCALING_KIND

export type ScalingBreakpoint<TValue extends object = object> = {
  id: string
  level: number
  order: number
  value: TValue
}

export type BreakpointScalingAuthored<
  TValue extends object = object,
  TSource extends ScalingSource = ScalingSource
> = {
  scalingKind: typeof SCALABLE_SCALING_KIND.BREAKPOINTS
  breakpoints: ScalingBreakpoint<TValue>[]
} & ScalingPayload<TSource>

export type ScalableValueAuthored<TValue extends object = object> =
  BreakpointScalingAuthored<TValue>

export const SCALING_AMOUNT_KIND = {
  FULL: 'FULL',
  HALF: 'HALF',
  DOUBLE: 'DOUBLE'
} as const

export type ScalingAmountKind = keyof typeof SCALING_AMOUNT_KIND

export type ScalingAmountOption = CoreMeta<ScalingAmountKind>

export const SCALING_AMOUNT_REGISTRY: Record<ScalingAmountKind, ScalingAmountOption> = {
  [SCALING_AMOUNT_KIND.FULL]: {
    code: SCALING_AMOUNT_KIND.FULL,
    label: 'Full',
    description: 'Uses the full value.'
  },

  [SCALING_AMOUNT_KIND.HALF]: {
    code: SCALING_AMOUNT_KIND.HALF,
    label: 'Half',
    description: 'Uses half the value.'
  },

  [SCALING_AMOUNT_KIND.DOUBLE]: {
    code: SCALING_AMOUNT_KIND.DOUBLE,
    label: 'Double',
    description: 'Uses double the value.'
  }
} as const

export const SCALING_AMOUNT_OPTIONS = valuesOf(SCALING_AMOUNT_REGISTRY)
