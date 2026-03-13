import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const EFFECT_KIND = {
  DAMAGE: 'DAMAGE',
  CONDITION: 'CONDITION'
} as const

export type EffectKind = keyof typeof EFFECT_KIND

export type EffectKindOption = CoreMeta<EffectKind>

export const EFFECT_KIND_REGISTRY: Record<EffectKind, EffectKindOption> = {
  [EFFECT_KIND.DAMAGE]: {
    code: EFFECT_KIND.DAMAGE,
    label: 'Damage',
    tooltip: 'This effect deals damage.',
    description: 'This effect deals damage.'
  },
  [EFFECT_KIND.CONDITION]: {
    code: EFFECT_KIND.CONDITION,
    label: 'Condition',
    tooltip: 'This effect applies a condition.',
    description: 'This effect applies a condition.'
  }
} as const

export const EFFECT_KIND_OPTIONS = valuesOf(
  EFFECT_KIND_REGISTRY
) as readonly EffectKindOption[]
