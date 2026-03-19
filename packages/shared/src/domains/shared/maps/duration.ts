import type { DurationAuthored } from '#authored'
import { DURATION_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'

const duration = buildNodeMap<DurationAuthored>()

export const DURATION_NODE_MAP = duration.define('duration', ({ map, nodes, cond, logic }) => {
  const local = cond.local()
  const { and, not } = logic

  const { selectSingle, number } = nodes

  map
    .set('durationKind', selectSingle(['durationKind'], 'Duration Kind', {
      kind: 'INLINE',
      options: DURATION_OPTIONS
    }))
    .set('amount', number(['amount'], 'Amount', {
      order: 2,
      showIf: and([
        not(local.field(['durationKind']).eq('INSTANTANEOUS')),
        not(local.field(['durationKind']).eq('UNTIL_DISPELLED'))
      ])
    }))
})
