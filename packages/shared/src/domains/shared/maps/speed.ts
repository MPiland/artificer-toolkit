import type { SpeedAuthored } from '#authored'
import { MEASUREMENT_UNIT_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'

const speed = buildNodeMap<SpeedAuthored>()

export const SPEED_NODE_MAP = speed.define('speed', ({ map, nodes, data }) => {
  const { number, selectSingle } = nodes
  const { table } = data
  map
    .set('speedId', selectSingle(['speedId'], 'Speed', {
      kind: 'DATA',
      relationship: table('speeds', {
        selectColumns: ['id', 'label', 'tooltip']
      })
    }, {
      order: 1,
      requiredIf: true
    }))
    .set('amount', number(['amount'], 'Amount', {
      order: 2,
      requiredIf: true
    }))
    .set('unit', selectSingle(['unit'], 'Unit', {
      kind: 'INLINE',
      options: MEASUREMENT_UNIT_OPTIONS
    }, {
      order: 3,
      requiredIf: true
    }))
})
