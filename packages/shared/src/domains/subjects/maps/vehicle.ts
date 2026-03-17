import { SIZE_OPTIONS, VEHICLE_CATEGORY_CODE } from '#core'
import { FEATURE_NODE_MAP } from '#maps'
import { buildNodeMap } from '#utils'
import type {
  CostAuthored,
  DetailAuthored,
  VehicleAuthored
} from '#authored'

const detailNode = buildNodeMap<DetailAuthored>()

const VEHICLE_DETAIL_NODE_MAP = detailNode.define('vehicleDetail', ({ map, nodes }) => {
  const { text, number } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('order', number(['order'], 'Order'))
})

const costNode = buildNodeMap<CostAuthored>()

const VEHICLE_COST_NODE_MAP = costNode.define('vehicleCost', ({ map, nodes }) => {
  const { number, text } = nodes

  map
    .set('amount', number(['amount'], 'Amount'))
    .set('currencyId', text(['currencyId'], 'Currency'))
})

const vehicleNode = buildNodeMap<VehicleAuthored>()

export const VEHICLE_NODE_MAP = vehicleNode.define('vehicle', ({ map, nodes }) => {
  const { text, number, selectSingle, groupArray, groupObject } = nodes

  const stringNode = buildNodeMap<{ value: string }>().define('vehicleString', ({ map: m, nodes: n }) => {
    m.set('value', n.text(['value'], 'Value'))
  })

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('details', groupArray(['details'], 'Details', () => VEHICLE_DETAIL_NODE_MAP))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set('category', selectSingle(['category'], 'Category', {
      kind: 'INLINE',
      options: [
        { code: VEHICLE_CATEGORY_CODE.LAND, label: 'Land' },
        { code: VEHICLE_CATEGORY_CODE.WATER, label: 'Water' },
        { code: VEHICLE_CATEGORY_CODE.AIR, label: 'Air' },
        { code: VEHICLE_CATEGORY_CODE.SPELLJAMMER, label: 'Spelljammer' }
      ]
    }))
    .set('size', selectSingle(['size'], 'Size', {
      kind: 'INLINE',
      options: SIZE_OPTIONS
    }))
    .set('armorClass', number(['armorClass'], 'Armor Class'))
    .set('hitPoints', number(['hitPoints'], 'Hit Points'))
    .set('speed', number(['speed'], 'Speed'))
    .set('speedNote', text(['speedNote'], 'Speed Note'))
    .set('crewMin', number(['crewMin'], 'Minimum Crew'))
    .set('crewMax', number(['crewMax'], 'Maximum Crew'))
    .set('passengerCapacity', number(['passengerCapacity'], 'Passenger Capacity'))
    .set('cargoCapacity', text(['cargoCapacity'], 'Cargo Capacity'))
    .set('cost', groupObject(['cost'], 'Cost', () => VEHICLE_COST_NODE_MAP))
    .set('properties', groupArray(['properties'], 'Properties', () => stringNode))
    .set('features', groupArray(['features'], 'Features', () => FEATURE_NODE_MAP))
})
