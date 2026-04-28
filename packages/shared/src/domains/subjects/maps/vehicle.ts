import { SIZE_OPTIONS, VEHICLE_CATEGORY_CODE } from '#core'
import { FEATURE_NODE_MAP } from '#maps'
import { buildNodeMap } from '#utils'
import type {
  CostAuthored,
  DetailAuthored,
  VehicleAuthored
} from '#authored'

const VEHICLE_SECTIONS = {
  basics: { id: 'basics', label: 'Basics', order: 10 },
  stats: { id: 'stats', label: 'Stats', order: 20 },
  capacity: { id: 'capacity', label: 'Capacity', order: 30 },
  features: { id: 'features', label: 'Features', order: 40 }
} as const

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
    .set('label', text(['label'], 'Name', { section: VEHICLE_SECTIONS.basics, order: 10 }))
    .set('description', text(['description'], 'Description', { section: VEHICLE_SECTIONS.basics, order: 20 }))
    .set('details', groupArray(['details'], 'Details', () => VEHICLE_DETAIL_NODE_MAP, { section: VEHICLE_SECTIONS.basics, order: 30 }))
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
    }, { section: VEHICLE_SECTIONS.basics, order: 40 }))
    .set('size', selectSingle(['size'], 'Size', {
      kind: 'INLINE',
      options: SIZE_OPTIONS
    }, { section: VEHICLE_SECTIONS.stats, order: 10 }))
    .set('armorClass', number(['armorClass'], 'Armor Class', { section: VEHICLE_SECTIONS.stats, order: 20 }))
    .set('hitPoints', number(['hitPoints'], 'Hit Points', { section: VEHICLE_SECTIONS.stats, order: 30 }))
    .set('speed', number(['speed'], 'Speed', { section: VEHICLE_SECTIONS.stats, order: 40 }))
    .set('speedNote', text(['speedNote'], 'Speed Note', { section: VEHICLE_SECTIONS.stats, order: 50 }))
    .set('crewMin', number(['crewMin'], 'Minimum Crew', { section: VEHICLE_SECTIONS.capacity, order: 10 }))
    .set('crewMax', number(['crewMax'], 'Maximum Crew', { section: VEHICLE_SECTIONS.capacity, order: 20 }))
    .set('passengerCapacity', number(['passengerCapacity'], 'Passenger Capacity', { section: VEHICLE_SECTIONS.capacity, order: 30 }))
    .set('cargoCapacity', text(['cargoCapacity'], 'Cargo Capacity', { section: VEHICLE_SECTIONS.capacity, order: 40 }))
    .set('cost', groupObject(['cost'], 'Cost', () => VEHICLE_COST_NODE_MAP, { section: VEHICLE_SECTIONS.capacity, order: 50 }))
    .set('properties', groupArray(['properties'], 'Properties', () => stringNode, { section: VEHICLE_SECTIONS.features, order: 10 }))
    .set('features', groupArray(['features'], 'Features', () => FEATURE_NODE_MAP, { section: VEHICLE_SECTIONS.features, order: 20 }))
})
