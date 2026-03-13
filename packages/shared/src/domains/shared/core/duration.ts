import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const DURATION_KIND = {
  INSTANTANEOUS: 'INSTANTANEOUS',
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
    description: 'An effect that occurs immediately and does not persist over time.',
    tooltip: 'No duration.'
  },
  [DURATION_KIND.TURN]: {
    code: DURATION_KIND.TURN,
    label: 'Turn',
    description: 'The duration of a single creature\'s turn.',
    tooltip: 'One creature\'s turn.'
  },
  [DURATION_KIND.ROUND]: {
    code: DURATION_KIND.ROUND,
    label: 'Round',
    description: 'A complete cycle of turns for all participants.',
    tooltip: 'One full round.'
  },
  [DURATION_KIND.MINUTE]: {
    code: DURATION_KIND.MINUTE,
    label: 'Minute',
    description: 'A short span of time composed of multiple rounds.',
    tooltip: 'One minute.'
  },
  [DURATION_KIND.HOUR]: {
    code: DURATION_KIND.HOUR,
    label: 'Hour',
    description: 'A longer continuous span of time.',
    tooltip: 'One hour.'
  },
  [DURATION_KIND.DAY]: {
    code: DURATION_KIND.DAY,
    label: 'Day',
    description: 'A full daily cycle.',
    tooltip: 'One day.'
  },
  [DURATION_KIND.WEEK]: {
    code: DURATION_KIND.WEEK,
    label: 'Week',
    description: 'A span of time consisting of multiple consecutive days.',
    tooltip: 'One week.'
  },
  [DURATION_KIND.MONTH]: {
    code: DURATION_KIND.MONTH,
    label: 'Month',
    description: 'A longer span of time used for extended effects or narrative pacing.',
    tooltip: 'One month.'
  },
  [DURATION_KIND.YEAR]: {
    code: DURATION_KIND.YEAR,
    label: 'Year',
    description: 'A long-term span of time measured in annual cycles.',
    tooltip: 'One year.'
  }
} as const

export const DURATION_OPTIONS = valuesOf(DURATION_REGISTRY) as DurationOption[]
