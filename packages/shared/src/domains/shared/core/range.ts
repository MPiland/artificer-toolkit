import type { CoreMeta } from '#core'

export const RANGE_KIND = {
  SELF: 'SELF',
  TOUCH: 'TOUCH',
  SIGHT: 'SIGHT',
  UNLIMITED: 'UNLIMITED',
  DISTANCE: 'DISTANCE'
} as const

export type RangeKind = keyof typeof RANGE_KIND

export type RangeOption = CoreMeta<RangeKind>

export const RANGE_REGISTRY: Record<RangeKind, RangeOption> = {
  [RANGE_KIND.SELF]: {
    code: RANGE_KIND.SELF,
    label: 'Self',
    description: 'The effect originates from and Targets the source itself.',
    tooltip: 'Affects the source.'
  },
  [RANGE_KIND.TOUCH]: {
    code: RANGE_KIND.TOUCH,
    label: 'Touch',
    description: 'The target must be physically reachable by the source.',
    tooltip: 'Within physical reach.'
  },
  [RANGE_KIND.SIGHT]: {
    code: RANGE_KIND.SIGHT,
    label: 'Sight',
    description: 'The target must be within the source\'s line of sight.',
    tooltip: 'Within sight.'
  },
  [RANGE_KIND.UNLIMITED]: {
    code: RANGE_KIND.UNLIMITED,
    label: 'Unlimited',
    description: 'Distance does not restrict the effect.',
    tooltip: 'No distance limit.'
  },
  [RANGE_KIND.DISTANCE]: {
    code: RANGE_KIND.DISTANCE,
    label: 'Distance',
    description: 'A set distance from the source to the target.',
    tooltip: 'A set distance.'
  }
}

export const RANGE_OPTIONS = Object.values(RANGE_REGISTRY) as RangeOption[]
