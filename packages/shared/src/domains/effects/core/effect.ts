import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const EFFECT_KIND = {
  DAMAGE: 'DAMAGE',
  CONDITION: 'CONDITION',
  HEAL: 'HEAL',
  APPLY_GRANT: 'APPLY_GRANT',
  TELEPORT: 'TELEPORT',
  MANIFEST: 'MANIFEST',
  RULE: 'RULE'
} as const

export const MANIFEST_KIND = {
  CREATURE: 'CREATURE',
  ZONE: 'ZONE',
  SENSOR: 'SENSOR',
  WEAPON: 'WEAPON',
  HAND: 'HAND',
  OBJECT: 'OBJECT',
  ILLUSION: 'ILLUSION'
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
  },
  [EFFECT_KIND.HEAL]: {
    code: EFFECT_KIND.HEAL,
    label: 'Heal',
    tooltip: 'This effect restores hit points or grants temporary hit points.',
    description: 'This effect restores hit points or grants temporary hit points.'
  },
  [EFFECT_KIND.APPLY_GRANT]: {
    code: EFFECT_KIND.APPLY_GRANT,
    label: 'Apply Grant',
    tooltip: 'This effect applies one or more typed grants for a duration or trigger.',
    description: 'This effect applies one or more typed grants for a duration or trigger.'
  },
  [EFFECT_KIND.TELEPORT]: {
    code: EFFECT_KIND.TELEPORT,
    label: 'Teleport',
    tooltip: 'This effect repositions a creature.',
    description: 'This effect repositions a creature.'
  },
  [EFFECT_KIND.MANIFEST]: {
    code: EFFECT_KIND.MANIFEST,
    label: 'Manifest',
    tooltip: 'This effect creates a persistent manifested thing such as a summon, wall, cloud, or sensor.',
    description: 'This effect creates a persistent manifested thing such as a summon, wall, cloud, or sensor.'
  },
  [EFFECT_KIND.RULE]: {
    code: EFFECT_KIND.RULE,
    label: 'Rule',
    tooltip: 'This effect records a constrained rules fallback when no better typed outcome exists yet.',
    description: 'This effect records a constrained rules fallback when no better typed outcome exists yet.'
  }
} as const

export const EFFECT_KIND_OPTIONS = valuesOf(
  EFFECT_KIND_REGISTRY
) as readonly EffectKindOption[]
