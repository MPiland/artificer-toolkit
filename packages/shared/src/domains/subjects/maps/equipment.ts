import {
  ABILITY_OPTIONS,
  EQUIPMENT_ATTRIBUTE_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_PROPERTY_REGISTRY,
  MEASUREMENT_UNIT_OPTIONS,
  OPERATIONS_OPTIONS,
  PROPERTIES_BY_CATEGORY
} from '#core'
import {
  CHARGE_NODE_MAP,
  CAPABILITY_NODE_MAP,
  FACET_NODE_MAP,
  FEATURE_NODE_MAP,
  MODIFIER_GRANT_NODE_MAP
} from '#maps'
import type {
  CapacityAuthored,
  ContainsAuthored,
  CostAuthored,
  EquipmentAbilitiesAuthored,
  EquipmentAuthored,
  FacetAuthored,
  FeatureAuthored,
  EquipmentVariantAuthored,
  WeightAuthored
} from '#authored'
import { buildNodeMap, buildRegistryOptionGroups, type NodeMap } from '#utils'

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

const capacityNode = buildNodeMap<CapacityAuthored>()

export const CAPACITY_NODE_MAP = capacityNode.define('capacity', ({ map, nodes }) => {
  const { number, selectSingle } = nodes

  map
    .set('amount', number(['amount'], 'Amount'))
    .set('unit', selectSingle(['unit'], 'Unit', {
      kind: 'INLINE',
      options: MEASUREMENT_UNIT_OPTIONS
    }))
})

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

const containsNode = buildNodeMap<ContainsAuthored>()

export const CONTAINS_NODE_MAP = containsNode.define('contains', ({ map, nodes, data }) => {
  const { selectSingle, number } = nodes
  const { table } = data

  map
    .set('equipmentId', selectSingle(['equipmentId'], 'Equipment', {
      kind: 'DATA',
      relationship: table('equipment', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('quantity', number(['quantity'], 'Quantity'))
})

type EquipmentAbilityValue = EquipmentAbilitiesAuthored['abilities'][number]

const equipmentAbilityValue = buildNodeMap<EquipmentAbilityValue>()

const EQUIPMENT_ABILITY_VALUE_NODE_MAP = equipmentAbilityValue.define('equipmentAbilityValue', ({ map, nodes }) => {
  const { selectSingle } = nodes

  map.set('ability', selectSingle(['ability'], 'Ability', {
    kind: 'INLINE',
    options: ABILITY_OPTIONS
  }))
})

const equipmentAbilities = buildNodeMap<EquipmentAbilitiesAuthored>()

const EQUIPMENT_ABILITIES_NODE_MAP = equipmentAbilities.define('equipmentAbilities', ({ map, nodes }) => {
  const { selectSingle, groupArray } = nodes

  map
    .set('op', selectSingle(['op'], 'Operation', {
      kind: 'INLINE',
      options: OPERATIONS_OPTIONS
    }))
    .set('abilities', groupArray(['abilities'], 'Abilities', () => EQUIPMENT_ABILITY_VALUE_NODE_MAP))
})

type EquipmentMapAuthored = EquipmentAuthored | EquipmentVariantAuthored

const EQUIPMENT_FEATURE_NODE_MAP = FEATURE_NODE_MAP as NodeMap<FeatureAuthored<'EQUIPMENT'>>
const EQUIPMENT_RESTRICTIONS_NODE_MAP = FACET_NODE_MAP as NodeMap<FacetAuthored<'EQUIPMENT'>>

const equipment = buildNodeMap<EquipmentMapAuthored>()

export const EQUIPMENT_NODE_MAP = equipment.define('equipment', ({ map, nodes, cond, logic, data }) => {
  const { text, number, selectSingle, selectMulti, groupObject, groupArray } = nodes
  const local = cond.local()
  const { not } = logic
  const { table } = data

  const equipmentPropertyOptionGroups = buildRegistryOptionGroups(EQUIPMENT_PROPERTY_REGISTRY, PROPERTIES_BY_CATEGORY, (category) => local.field(['category']).eq(category), local.field(['category']).empty())

  const isBaseEquipment = not(local.field(['category']).eq('VARIANT'))

  map
    .set('kind', text(['kind'], 'Kind'))
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('attributes', selectMulti(['attributes'], 'Attributes', {
      kind: 'INLINE',
      options: EQUIPMENT_ATTRIBUTE_OPTIONS
    }))
    .set('quote', text(['quote'], 'Quote'))
    .set('cost', groupObject(['cost'], 'Cost', () => COST_NODE_MAP))
    .set('weight', groupObject(['weight'], 'Weight', () => WEIGHT_NODE_MAP))
    .set('capabilities', groupArray(['capabilities'], 'Capabilities', () => CAPABILITY_NODE_MAP))
    .set('charges', groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, {
      showIf: local.field(['attributes']).contains(['LIMITED_USE'])
    }))
    .set('capacity', groupObject(['capacity'], 'Capacity', () => CAPACITY_NODE_MAP))
    .set('modifiers', groupArray(['modifiers'], 'Modifiers', () => MODIFIER_GRANT_NODE_MAP))
    .set('maxStack', number(['maxStack'], 'Max Stack', {
      showIf: local.field(['attributes']).contains(['STACKABLE'])
    }))
    .set('rarityId', selectSingle(['rarityId'], 'Rarity', {
      kind: 'DATA',
      relationship: table('rarities', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('maxBonus', number(['maxBonus'], 'Max Bonus'))
    .set('armorClass', number(['armorClass'], 'Armor Class'))
    .set('contains', groupArray(['contains'], 'Contains', () => CONTAINS_NODE_MAP))
    .set('features', groupArray(['features'], 'Features', () => EQUIPMENT_FEATURE_NODE_MAP))
    .set('restrictions', groupObject(['restrictions'], 'Restrictions', () => EQUIPMENT_RESTRICTIONS_NODE_MAP))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set('category', selectSingle(['category'], 'Category', {
      kind: 'INLINE',
      options: EQUIPMENT_CATEGORY_OPTIONS
    }))
    .set('parentEquipmentId', selectSingle(['parentEquipmentId'], 'Parent Equipment', {
      kind: 'DATA',
      relationship: table('equipment', {
        selectColumns: ['id', 'label']
      })
    }, {
      showIf: local.field(['category']).eq('VARIANT')
    }))
    .set('properties', selectMulti(['properties'], 'Properties', {
      kind: 'INLINE',
      optionGroups: equipmentPropertyOptionGroups
    }))
    .set('abilities', groupArray(['abilities'], 'Abilities', () => EQUIPMENT_ABILITIES_NODE_MAP, {
      showIf: isBaseEquipment
    }))
})
