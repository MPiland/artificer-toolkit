import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const RANGE_KIND = {
  SELF: 'SELF',
  TOUCH: 'TOUCH',
  SIGHT: 'SIGHT',
  SPECIAL: 'SPECIAL',
  UNLIMITED: 'UNLIMITED',
  DISTANCE: 'DISTANCE'
} as const

export type RangeKind = keyof typeof RANGE_KIND

export type RangeOption = CoreMeta<RangeKind>

export const RANGE_REGISTRY: Record<RangeKind, RangeOption> = {
  [RANGE_KIND.SELF]: {
    code: RANGE_KIND.SELF,
    label: 'Self',
    description: 'Affects the source.'
  },
  [RANGE_KIND.TOUCH]: {
    code: RANGE_KIND.TOUCH,
    label: 'Touch',
    description: 'Within physical reach.'
  },
  [RANGE_KIND.SIGHT]: {
    code: RANGE_KIND.SIGHT,
    label: 'Sight',
    description: 'Within sight.'
  },
  [RANGE_KIND.SPECIAL]: {
    code: RANGE_KIND.SPECIAL,
    label: 'Special',
    description: 'Defined by special rules.'
  },
  [RANGE_KIND.UNLIMITED]: {
    code: RANGE_KIND.UNLIMITED,
    label: 'Unlimited',
    description: 'No distance limit.'
  },
  [RANGE_KIND.DISTANCE]: {
    code: RANGE_KIND.DISTANCE,
    label: 'Distance',
    description: 'A set distance.'
  }
}

export const RANGE_OPTIONS = valuesOf(RANGE_REGISTRY) as RangeOption[]

/** A sense reaches a set distance or is unlimited; no other range kind has a meaning for a sense. */
export const SENSE_RANGE_KINDS = [RANGE_KIND.DISTANCE, RANGE_KIND.UNLIMITED] as const

export type SenseRangeKind = (typeof SENSE_RANGE_KINDS)[number]
