import type { DurationAuthored } from '#authored'
import { DURATION_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'

const duration = buildNodeMap<DurationAuthored>()

export const DURATION_NODE_MAP = duration.define((map, { not, and, local }) => map({
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
      not(local('durationKind').eq('INSTANTANEOUS')),
      not(local('durationKind').empty())
    ])
  }
}))
