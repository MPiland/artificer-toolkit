import { VEHICLE_CATEGORY_OPTIONS } from '#core'
import { COST_NODE_MAP, FEATURE_NODE_MAP, WEIGHT_NODE_MAP } from '#maps'
import { AUTHORED_LIMITS, buildNodeMap } from '#utils'
import type { DetailAuthored, VehicleAuthored } from '#authored'

const VEHICLE_STEPS = {
  overview: { id: 'overview', label: 'Overview', order: 10 },
  stats: { id: 'stats', label: 'Stats', order: 20 },
  capacity: { id: 'capacity', label: 'Crew and Capacity', order: 30 },
  economy: { id: 'economy', label: 'Cost and Properties', order: 40 },
  features: { id: 'features', label: 'Features', order: 50 },
  details: { id: 'details', label: 'Details', order: 60 }
} as const

const VEHICLE_SECTIONS = {
  basics: { id: 'basics', label: 'Basics', order: 10, step: VEHICLE_STEPS.overview },
  stats: { id: 'stats', label: 'Stats', order: 10, step: VEHICLE_STEPS.stats },
  capacity: { id: 'capacity', label: 'Capacity', order: 10, step: VEHICLE_STEPS.capacity },
  economy: { id: 'economy', label: 'Cost and Properties', order: 10, step: VEHICLE_STEPS.economy },
  features: { id: 'features', label: 'Features', order: 10, step: VEHICLE_STEPS.features },
  details: { id: 'details', label: 'Details', order: 10, step: VEHICLE_STEPS.details }
} as const

const detailNode = buildNodeMap<DetailAuthored>()

export const VEHICLE_DETAIL_NODE_MAP = detailNode.define('vehicleDetail', ({ map, nodes }) => {
  const { text, richText, number } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', richText(['description'], 'Description'))
    .set('order', number(['order'], 'Order'))
})

const vehicleNode = buildNodeMap<VehicleAuthored>()

export const VEHICLE_NODE_MAP = vehicleNode.define('vehicle', ({ map, nodes, data }) => {
  const { text, richText, number, selectSingle, groupArray, groupObject } = nodes

  const stringNode = buildNodeMap<{ value: string }>().define(
    'vehicleString',
    ({ map: m, nodes: n }) => {
      m.set('value', n.text(['value'], 'Value'))
    }
  )

  map
    .set('id', text(['id'], 'ID'))
    .set(
      'label',
      text(['label'], 'Name', {
        section: VEHICLE_SECTIONS.basics,
        order: 10,
        requiredIf: true
      })
    )
    .set(
      'description',
      richText(['description'], 'Description', { section: VEHICLE_SECTIONS.basics, order: 20 })
    )
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set(
      'category',
      selectSingle(
        ['category'],
        'Category',
        {
          kind: 'INLINE_OPTIONS',
          options: VEHICLE_CATEGORY_OPTIONS
        },
        {
          section: VEHICLE_SECTIONS.basics,
          order: 30,
          requiredIf: true
        }
      )
    )
    .set(
      'size',
      selectSingle(
        ['size'],
        'Size',
        {
          kind: 'DATA',
          relationship: data.table('sizes', { selectColumns: ['id', 'label', 'description'] })
        },
        { section: VEHICLE_SECTIONS.stats, order: 10 }
      )
    )
    .set(
      'armorClass',
      number(['armorClass'], 'Armor Class', { section: VEHICLE_SECTIONS.stats, order: 20 })
    )
    .set(
      'hitPoints',
      number(['hitPoints'], 'Hit Points', { section: VEHICLE_SECTIONS.stats, order: 30 })
    )
    .set(
      'speed',
      number(['speed'], 'Speed', {
        constraints: { minimum: 0 },
        section: VEHICLE_SECTIONS.stats,
        order: 40
      })
    )
    .set(
      'speedNote',
      text(['speedNote'], 'Speed Note', {
        constraints: { maximumLength: AUTHORED_LIMITS.plainTextCharacters },
        section: VEHICLE_SECTIONS.stats,
        order: 50
      })
    )
    .set(
      'crewMin',
      number(['crewMin'], 'Minimum Crew', { section: VEHICLE_SECTIONS.capacity, order: 10 })
    )
    .set(
      'crewMax',
      number(['crewMax'], 'Maximum Crew', { section: VEHICLE_SECTIONS.capacity, order: 20 })
    )
    .set(
      'passengerCapacity',
      number(['passengerCapacity'], 'Passenger Capacity', {
        section: VEHICLE_SECTIONS.capacity,
        order: 30
      })
    )
    .set(
      'cargoCapacity',
      text(['cargoCapacity'], 'Cargo Capacity', {
        constraints: { maximumLength: AUTHORED_LIMITS.plainTextCharacters },
        section: VEHICLE_SECTIONS.capacity,
        order: 40
      })
    )
    .set(
      'weight',
      groupObject(['weight'], 'Weight', () => WEIGHT_NODE_MAP, {
        presentation: 'inline',
        section: VEHICLE_SECTIONS.economy,
        order: 10
      })
    )
    .set(
      'cost',
      groupObject(['cost'], 'Cost', () => COST_NODE_MAP, {
        presentation: 'inline',
        section: VEHICLE_SECTIONS.economy,
        order: 20
      })
    )
    .set(
      'properties',
      groupArray(['properties'], 'Properties', () => stringNode, {
        presentation: 'inline',
        section: VEHICLE_SECTIONS.economy,
        order: 30
      })
    )
    .set(
      'features',
      groupArray(['features'], 'Features', () => FEATURE_NODE_MAP, {
        presentation: 'branch',
        section: VEHICLE_SECTIONS.features,
        order: 10
      })
    )
    .set(
      'details',
      groupArray(['details'], 'Details', () => VEHICLE_DETAIL_NODE_MAP, {
        presentation: 'inline',
        section: VEHICLE_SECTIONS.details,
        order: 10
      })
    )
})
