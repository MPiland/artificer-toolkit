import type { DurationAuthored } from '#authored'
import { DURATION_OPTIONS } from '#core'
import { buildNodeMap } from '#util'

const duration = buildNodeMap<DurationAuthored>()

export const DURATION_NODE_MAP = duration.define((map, { not, and, field }) => map({
  durationKind: {
    kind: 'INPUT',
    label: 'Duration Kind',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: DURATION_OPTIONS
    }
  },
  amount: {
    kind: 'INPUT',
    label: 'Amount',
    type: 'NUMBER',
    showIf: and([
      not(field('durationKind').eq('INSTANTANEOUS')),
      not(field('durationKind').empty())
    ])
  }
}))
