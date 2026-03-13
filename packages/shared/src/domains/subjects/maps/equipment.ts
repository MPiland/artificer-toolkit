import { buildNodeMap, type NodeMap } from '#utils'
import type { CostAuthored, EquipmentAuthored, EquipmentVariantAuthored, WeightAuthored } from '#authored'
import { EQUIPMENT_ATTRIBUTE_OPTIONS, MEASUREMENT_UNIT_OPTIONS } from '#core'
import { CHARGE_NODE_MAP } from '#maps'
import { Merge } from 'type-fest'

// Weight Node Map - Fixed with proper DSL
const weightNode = buildNodeMap<WeightAuthored>()
export const WEIGHT_NODE_MAP = weightNode.define('weight', ({ map, nodes }) => {
  const { number, selectSingle } = nodes
  map
    .set('amount', number(['amount'], 'Amount'))
    .set('unit', selectSingle(['unit'], 'Unit', {
      kind: 'INLINE',
      options: MEASUREMENT_UNIT_OPTIONS
    }))
})

// Cost Node Map - Fixed with proper DSL
const costNode = buildNodeMap<CostAuthored>()
export const COST_NODE_MAP = costNode.define('cost', ({ map, nodes, data }) => {
  const { number, selectSingle } = nodes
  const { table } = data
  map
    .set('amount', number(['amount'], 'Amount'))
    .set('currencyId', selectSingle(['currencyId'], 'Currency', {
      kind: 'DATA',
      relationship: table('currencies', {
        selectColumns: ['id', 'label']
      })
    }))
})

type MergedEquipment = Merge<EquipmentVariantAuthored, EquipmentAuthored>

const equipment = buildNodeMap<MergedEquipment>()

type EquipmentNodeMap = NodeMap<MergedEquipment>

export const EQUIPMENT_NODE_MAP: EquipmentNodeMap = equipment.define('equipment', ({ map, nodes, data }) => {
  const { text, selectMulti } = nodes
  const { table } = data
  map
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('attributes', selectMulti(['attributes'], 'Attributes', {
      kind: 'INLINE',
      options: EQUIPMENT_ATTRIBUTE_OPTIONS
    }))
})
