import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const DURATION_KIND = {
  INSTANTANEOUS: 'INSTANTANEOUS',
  UNTIL_DISPELLED: 'UNTIL_DISPELLED',
  TURN: 'TURN',
  ROUND: 'ROUND',
  MINUTE: 'MINUTE',
  HOUR: 'HOUR',
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
  YEAR: 'YEAR'
} as const

export type DurationKind = keyof typeof DURATION_KIND

export type DurationOption = CoreMeta<DurationKind>

export const DURATION_REGISTRY: Record<DurationKind, DurationOption> = {
  [DURATION_KIND.INSTANTANEOUS]: {
    code: DURATION_KIND.INSTANTANEOUS,
    label: 'Instantaneous',
    description: 'No duration.'
  },
  [DURATION_KIND.UNTIL_DISPELLED]: {
    code: DURATION_KIND.UNTIL_DISPELLED,
    label: 'Until Dispelled',
    description: 'Lasts until dispelled.'
  },
  [DURATION_KIND.TURN]: {
    code: DURATION_KIND.TURN,
    label: 'Turn',
    description: "One creature's turn."
  },
  [DURATION_KIND.ROUND]: {
    code: DURATION_KIND.ROUND,
    label: 'Round',
    description: 'One full round.'
  },
  [DURATION_KIND.MINUTE]: {
    code: DURATION_KIND.MINUTE,
    label: 'Minute',
    description: 'One minute.'
  },
  [DURATION_KIND.HOUR]: {
    code: DURATION_KIND.HOUR,
    label: 'Hour',
    description: 'One hour.'
  },
  [DURATION_KIND.DAY]: {
    code: DURATION_KIND.DAY,
    label: 'Day',
    description: 'One day.'
  },
  [DURATION_KIND.WEEK]: {
    code: DURATION_KIND.WEEK,
    label: 'Week',
    description: 'One week.'
  },
  [DURATION_KIND.MONTH]: {
    code: DURATION_KIND.MONTH,
    label: 'Month',
    description: 'One month.'
  },
  [DURATION_KIND.YEAR]: {
    code: DURATION_KIND.YEAR,
    label: 'Year',
    description: 'One year.'
  }
} as const

export const DURATION_OPTIONS = valuesOf(DURATION_REGISTRY) as DurationOption[]
