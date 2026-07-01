import {
  EQUIPMENT_ATTRIBUTE_OPTIONS,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_PROPERTY_REGISTRY,
  MEASUREMENT_UNIT_OPTIONS,
  PROPERTIES_BY_CATEGORY
} from '#core'
import {
  CHARGE_NODE_MAP,
  EFFECT_NODE_MAP,
  FACET_NODE_MAP,
  FEATURE_NODE_MAP,
  MODIFIER_GRANT_NODE_MAP
} from '#maps'
import type {
  CapacityAuthored,
  ContainsAuthored,
  CostAuthored,
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

type EquipmentMapAuthored = EquipmentAuthored | EquipmentVariantAuthored

export const EQUIPMENT_FEATURE_NODE_MAP = FEATURE_NODE_MAP as NodeMap<FeatureAuthored<'EQUIPMENT'>>
export const EQUIPMENT_RESTRICTIONS_NODE_MAP = FACET_NODE_MAP as NodeMap<FacetAuthored<'EQUIPMENT'>>
export const EQUIPMENT_CHARGE_NODE_MAP = CHARGE_NODE_MAP as NodeMap<NonNullable<EquipmentAuthored['charges']>>
export const EQUIPMENT_MODIFIER_NODE_MAP = MODIFIER_GRANT_NODE_MAP as NodeMap<NonNullable<EquipmentAuthored['modifiers']>[number]>

const EQUIPMENT_SECTIONS = {
  basics: { id: 'basics', label: 'Basics', order: 10 },
  properties: { id: 'properties', label: 'Properties', order: 20 },
  economy: { id: 'economy', label: 'Cost and Weight', order: 30 },
  mechanics: { id: 'mechanics', label: 'Mechanics', order: 40 },
  contents: { id: 'contents', label: 'Contents', order: 50 }
} as const

const equipment = buildNodeMap<EquipmentMapAuthored>()

export const EQUIPMENT_NODE_MAP = equipment.define('equipment', ({ map, nodes, cond, data, logic }) => {
  const { text, richText, number, selectSingle, selectMulti, groupObject, groupArray } = nodes
  const local = cond.local()
  const { table } = data
  const { not } = logic
  const isVariant = local.field(['category']).eq(EQUIPMENT_CATEGORY_CODE.VARIANT)
  const isBaseEquipment = not(isVariant)

  const equipmentPropertyOptionGroups = buildRegistryOptionGroups(EQUIPMENT_PROPERTY_REGISTRY, PROPERTIES_BY_CATEGORY, (category) => local.field(['category']).eq(category), local.field(['category']).empty())

  map
    .set('kind', text(['kind'], 'Kind'))
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Name', {
      section: EQUIPMENT_SECTIONS.basics,
      order: 10,
      requiredIf: true
    }))
    .set('description', richText(['description'], 'Description', { section: EQUIPMENT_SECTIONS.basics, order: 20 }))
    .set('attributes', selectMulti(['attributes'], 'Attributes', {
      kind: 'INLINE',
      options: EQUIPMENT_ATTRIBUTE_OPTIONS
    }, {
      section: EQUIPMENT_SECTIONS.properties,
      order: 20,
      showIf: isBaseEquipment,
      hiddenBehavior: 'CLEAR'
    }))
    .set('quote', richText(['quote'], 'Quote', { section: EQUIPMENT_SECTIONS.basics, order: 30 }))
    .set('cost', groupObject(['cost'], 'Cost', () => COST_NODE_MAP, {
      section: EQUIPMENT_SECTIONS.economy,
      order: 10,
      showIf: isBaseEquipment,
      hiddenBehavior: 'CLEAR'
    }))
    .set('weight', groupObject(['weight'], 'Weight', () => WEIGHT_NODE_MAP, {
      section: EQUIPMENT_SECTIONS.economy,
      order: 20,
      showIf: isBaseEquipment,
      hiddenBehavior: 'CLEAR'
    }))
    .set('effects', groupArray(['effects'], 'Effects', () => EFFECT_NODE_MAP, { section: EQUIPMENT_SECTIONS.mechanics, order: 10 }))
    .set('charges', groupObject(['charges'], 'Charges', () => EQUIPMENT_CHARGE_NODE_MAP, {
      section: EQUIPMENT_SECTIONS.mechanics,
      order: 20,
      showIf: {
        or: [
          isVariant,
          local.field(['attributes']).contains(['LIMITED_USE'])
        ]
      },
      hiddenBehavior: 'CLEAR'
    }))
    .set('capacity', groupObject(['capacity'], 'Capacity', () => CAPACITY_NODE_MAP, {
      section: EQUIPMENT_SECTIONS.properties,
      order: 30,
      showIf: isBaseEquipment,
      hiddenBehavior: 'CLEAR'
    }))
    .set('modifiers', groupArray(['modifiers'], 'Modifiers', () => EQUIPMENT_MODIFIER_NODE_MAP, { section: EQUIPMENT_SECTIONS.mechanics, order: 30 }))
    .set('maxStack', number(['maxStack'], 'Max Stack', {
      section: EQUIPMENT_SECTIONS.properties,
      order: 40,
      showIf: {
        and: [
          isBaseEquipment,
          local.field(['attributes']).contains(['STACKABLE'])
        ]
      },
      hiddenBehavior: 'CLEAR'
    }))
    .set('rarityId', selectSingle(['rarityId'], 'Rarity', {
      kind: 'DATA',
      relationship: table('rarities', {
        selectColumns: ['id', 'label']
      })
    }, { section: EQUIPMENT_SECTIONS.properties, order: 50 }))
    .set('maxBonus', number(['maxBonus'], 'Max Bonus', { section: EQUIPMENT_SECTIONS.mechanics, order: 40 }))
    .set('armorClass', number(['armorClass'], 'Armor Class', {
      section: EQUIPMENT_SECTIONS.mechanics,
      order: 50,
      showIf: isBaseEquipment,
      hiddenBehavior: 'CLEAR'
    }))
    .set('contains', groupArray(['contains'], 'Contains', () => CONTAINS_NODE_MAP, {
      section: EQUIPMENT_SECTIONS.contents,
      order: 10,
      showIf: isBaseEquipment,
      hiddenBehavior: 'CLEAR'
    }))
    .set('features', groupArray(['features'], 'Features', () => EQUIPMENT_FEATURE_NODE_MAP, { section: EQUIPMENT_SECTIONS.mechanics, order: 60 }))
    .set('restrictions', groupObject(['restrictions'], 'Restrictions', () => EQUIPMENT_RESTRICTIONS_NODE_MAP, { section: EQUIPMENT_SECTIONS.mechanics, order: 70 }))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set('category', selectSingle(['category'], 'Category', {
      kind: 'INLINE',
      options: EQUIPMENT_CATEGORY_OPTIONS
    }, { section: EQUIPMENT_SECTIONS.properties, order: 10 }))
    .set('parentEquipmentId', selectSingle(['parentEquipmentId'], 'Parent Equipment', {
      kind: 'DATA',
      relationship: table('equipment', {
        selectColumns: ['id', 'label']
      })
    }, {
      section: EQUIPMENT_SECTIONS.properties,
      order: 60,
      showIf: isVariant,
      hiddenBehavior: 'CLEAR'
    }))
    .set('properties', selectMulti(['properties'], 'Properties', {
      kind: 'INLINE',
      optionGroups: equipmentPropertyOptionGroups
    }, { section: EQUIPMENT_SECTIONS.properties, order: 70 }))
})

