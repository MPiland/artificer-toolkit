import type { SpeedAuthored } from '#authored'
import { MEASUREMENT_UNIT_OPTIONS } from '#core'
import { buildNodeMap } from '#util'

const speed = buildNodeMap<SpeedAuthored>()

export const SPEED_NODE_MAP = speed.define((map) => map({
  speedId: {
    kind: 'INPUT',
    label: 'Speed',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'DATA',
      relationship: {
        kind: 'ROOT',
        table: 'speeds'
      }
    }
  },
  amount: {
    kind: 'INPUT',
    label: 'Distance Amount',
    type: 'NUMBER'
  },
  unit: {
    kind: 'INPUT',
    label: 'Distance Unit',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: MEASUREMENT_UNIT_OPTIONS
    }
  }
}))
