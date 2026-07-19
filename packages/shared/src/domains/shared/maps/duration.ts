import type { DurationAuthored } from '#authored'
import { DURATION_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'
import { createBreakpointScalingNodeMap } from './scaling.js'

type DurationValueAuthored = {
  amount: number
}

const duration = buildNodeMap<DurationAuthored>()
const durationValue = buildNodeMap<DurationValueAuthored>()

const DURATION_VALUE_NODE_MAP = durationValue.define('durationValue', ({ map, nodes }) => {
  const { number } = nodes

  map.set('amount', number(['amount'], 'Amount', {
    order: 1,
    requiredIf: true
  }))
})

const DURATION_SCALING_NODE_MAP
  = createBreakpointScalingNodeMap('durationScaling', 'Duration Value', DURATION_VALUE_NODE_MAP)

export const DURATION_NODE_MAP = duration.define('duration', ({ map, nodes, cond, logic }) => {
  const local = cond.local()
  const { and, not } = logic

  const { selectSingle, number, groupObject } = nodes

  map
    .set('durationKind', selectSingle(['durationKind'], 'Duration Kind', {
      kind: 'INLINE_OPTIONS',
      options: DURATION_OPTIONS
    }))
    .set('amount', number(['amount'], 'Amount', {
      order: 2,
      showIf: and([
        not(local.field(['durationKind']).eq('INSTANTANEOUS')),
        not(local.field(['durationKind']).eq('UNTIL_DISPELLED'))
      ])
    }))
    .set('scaling', groupObject(['scaling'], 'Scaling', () => DURATION_SCALING_NODE_MAP, { presentation: 'inline',
      order: 3,
      showIf: and([
        not(local.field(['durationKind']).eq('INSTANTANEOUS')),
        not(local.field(['durationKind']).eq('UNTIL_DISPELLED'))
      ])
    }))
})
