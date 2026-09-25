import {
  EQUIPMENT_ATTRIBUTE_OPTIONS,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_GRIP_OPTIONS,
  EQUIPMENT_PROPERTY_REGISTRY,
  MEASUREMENT_UNIT_OPTIONS,
  PROPERTIES_BY_CATEGORY
} from '#core'
import {
  CHARGE_NODE_MAP,
  EFFECT_NODE_MAP,
  CHARACTER_FACET_NODE_MAP,
  FEATURE_NODE_MAP,
  MODIFIER_GRANT_NODE_MAP
} from '#maps'
import type {
  CapacityAuthored,
  ContainsAuthored,
  CostAuthored,
  EquipmentAuthored,
  EquipmentEffectAuthored,
  FacetAuthored,
  FeatureAuthored,
  EquipmentVariantAuthored,
  WeightAuthored
} from '#authored'
import {
  AUTHORING_ACTION_PRESENTATIONS,
  buildNodeMap,
  buildRegistryOptionGroups,
  type NodeMap
} from '#utils'

const weightNode = buildNodeMap<WeightAuthored>()

export const WEIGHT_NODE_MAP = weightNode.define('weight', ({ map, nodes }) => {
  const { number, selectSingle } = nodes

  map.set('amount', number(['amount'], 'Amount')).set(
    'unit',
    selectSingle(['unit'], 'Unit', {
      kind: 'INLINE_OPTIONS',
      options: MEASUREMENT_UNIT_OPTIONS
    })
  )
})

const capacityNode = buildNodeMap<CapacityAuthored>()

export const CAPACITY_NODE_MAP = capacityNode.define('capacity', ({ map, nodes }) => {
  const { number, selectSingle } = nodes

  map.set('amount', number(['amount'], 'Amount')).set(
    'unit',
    selectSingle(['unit'], 'Unit', {
      kind: 'INLINE_OPTIONS',
      options: MEASUREMENT_UNIT_OPTIONS
    })
  )
})

const costNode = buildNodeMap<CostAuthored>()

export const COST_NODE_MAP = costNode.define('cost', ({ map, nodes, data }) => {
  const { number, selectSingle } = nodes
  const { table } = data

  map.set('amount', number(['amount'], 'Amount')).set(
    'currencyId',
    selectSingle(['currencyId'], 'Currency', {
      kind: 'DATA',
      relationship: table('currencies', {
        selectColumns: ['id', 'label']
      })
    })
  )
})

const containsNode = buildNodeMap<ContainsAuthored>()

export const CONTAINS_NODE_MAP = containsNode.define('contains', ({ map, nodes, data }) => {
  const { selectSingle, number } = nodes
  const { table } = data

  map
    .set(
      'equipmentId',
      selectSingle(['equipmentId'], 'Equipment', {
        kind: 'DATA',
        relationship: table('equipment', {
          selectColumns: ['id', 'label']
        })
      })
    )
    .set('quantity', number(['quantity'], 'Quantity'))
})

type EquipmentMapAuthored = EquipmentAuthored | EquipmentVariantAuthored

const equipmentEffect = buildNodeMap<EquipmentEffectAuthored>()

/**
 * The shared effect editor plus the grip a weapon attack is made with. Node conditions cannot read
 * the child invocation scope (`invocation.triggerCode`), so the grip stays visible and the Equipment
 * schema enforces it on save: required exactly for non-passive weapon attack effects, null otherwise.
 */
const EQUIPMENT_EFFECT_NODE_MAP = equipmentEffect.define(
  'equipmentEffect',
  ({ map, nodes }) => {
    map.merge(EFFECT_NODE_MAP.nodes as NodeMap<EquipmentEffectAuthored>['nodes']).set(
      'grip',
      nodes.selectSingle(['grip'], 'Weapon attack grip', {
        kind: 'INLINE_OPTIONS',
        options: EQUIPMENT_GRIP_OPTIONS
      })
    )
  },
  EFFECT_NODE_MAP.authoring
)

export const EQUIPMENT_FEATURE_NODE_MAP = FEATURE_NODE_MAP as NodeMap<FeatureAuthored<'EQUIPMENT'>>
export const EQUIPMENT_RESTRICTIONS_NODE_MAP = CHARACTER_FACET_NODE_MAP as NodeMap<
  FacetAuthored<'CHARACTER'>
>
export const EQUIPMENT_CHARGE_NODE_MAP = CHARGE_NODE_MAP as NodeMap<
  NonNullable<EquipmentAuthored['charges']>
>
export const EQUIPMENT_MODIFIER_NODE_MAP = MODIFIER_GRANT_NODE_MAP as NodeMap<
  NonNullable<EquipmentAuthored['modifiers']>[number]
>

const EQUIPMENT_SECTIONS = {
  basics: {
    id: 'basics',
    label: 'Basics',
    description: "Define the item's identity and core details.",
    order: 10
  },
  properties: {
    id: 'properties',
    label: 'Properties',
    description: 'Choose the rules and traits that shape how this item behaves.',
    order: 20
  },
  economy: {
    id: 'economy',
    label: 'Cost and Weight',
    description: "Set the item's physical and market details.",
    order: 30
  },
  effects: {
    id: 'effects',
    label: 'Effects',
    description: 'Configure the outcomes produced by using this item.',
    order: 40
  },
  grants: {
    id: 'grants',
    label: 'Grants',
    description: 'Add modifiers and other benefits this item provides.',
    order: 50
  },
  features: {
    id: 'features',
    label: 'Features',
    description: 'Add and organize the abilities this item provides.',
    order: 60
  },
  contents: {
    id: 'contents',
    label: 'Contents',
    description: 'Define the items or resources contained within this item.',
    order: 70
  }
} as const

const equipment = buildNodeMap<EquipmentMapAuthored>()

export const EQUIPMENT_NODE_MAP = equipment.define(
  'equipment',
  ({ map, nodes, cond, data, logic }) => {
    const { text, richText, number, toggle, selectSingle, selectMulti, groupObject, groupArray } =
      nodes
    const local = cond.local()
    const { table } = data
    const { not } = logic
    const isVariant = local.field(['category']).eq(EQUIPMENT_CATEGORY_CODE.VARIANT)
    const isBaseEquipment = not(isVariant)

    const equipmentPropertyOptionGroups = buildRegistryOptionGroups(
      EQUIPMENT_PROPERTY_REGISTRY,
      PROPERTIES_BY_CATEGORY,
      (category) => local.field(['category']).eq(category),
      local.field(['category']).empty()
    )

    map
      .set('kind', text(['kind'], 'Kind', { authoring: { exposure: 'system' } }))
      .set('id', text(['id'], 'ID'))
      .set(
        'label',
        text(['label'], 'Name', {
          section: EQUIPMENT_SECTIONS.basics,
          order: 10,
          requiredIf: true
        })
      )
      .set(
        'description',
        richText(['description'], 'Description', { section: EQUIPMENT_SECTIONS.basics, order: 20 })
      )
      .set(
        'attributes',
        selectMulti(
          ['attributes'],
          'Attributes',
          {
            kind: 'INLINE_OPTIONS',
            options: EQUIPMENT_ATTRIBUTE_OPTIONS
          },
          {
            section: EQUIPMENT_SECTIONS.properties,
            order: 20,
            showIf: isBaseEquipment,
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set('quote', richText(['quote'], 'Quote', { section: EQUIPMENT_SECTIONS.basics, order: 30 }))
      .set(
        'cost',
        groupObject(['cost'], 'Cost', () => COST_NODE_MAP, {
          presentation: 'inline',
          section: EQUIPMENT_SECTIONS.economy,
          order: 10,
          showIf: isBaseEquipment,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'weight',
        groupObject(['weight'], 'Weight', () => WEIGHT_NODE_MAP, {
          presentation: 'inline',
          section: EQUIPMENT_SECTIONS.economy,
          order: 20,
          showIf: isBaseEquipment,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'effects',
        groupArray(['effects'], 'Effects', () => EQUIPMENT_EFFECT_NODE_MAP, {
          presentation: 'branch',
          section: EQUIPMENT_SECTIONS.effects,
          order: 10
        })
      )
      .set(
        'charges',
        groupObject(['charges'], 'Charges', () => EQUIPMENT_CHARGE_NODE_MAP, {
          presentation: 'inline',
          section: EQUIPMENT_SECTIONS.basics,
          order: 40,
          showIf: logic.or([isVariant, local.field(['attributes']).contains(['LIMITED_USE'])]),
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'capacity',
        groupObject(['capacity'], 'Capacity', () => CAPACITY_NODE_MAP, {
          presentation: 'inline',
          section: EQUIPMENT_SECTIONS.properties,
          order: 30,
          showIf: isBaseEquipment,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'modifiers',
        groupArray(['modifiers'], 'Modifiers', () => EQUIPMENT_MODIFIER_NODE_MAP, {
          presentation: 'focused',
          section: EQUIPMENT_SECTIONS.grants,
          order: 10
        })
      )
      .set(
        'maxStack',
        number(['maxStack'], 'Max Stack', {
          section: EQUIPMENT_SECTIONS.properties,
          order: 40,
          showIf: logic.and([isBaseEquipment, local.field(['attributes']).contains(['STACKABLE'])]),
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'rarityId',
        selectSingle(
          ['rarityId'],
          'Rarity',
          {
            kind: 'DATA',
            relationship: table('rarities', {
              selectColumns: ['id', 'label']
            })
          },
          { section: EQUIPMENT_SECTIONS.properties, order: 50 }
        )
      )
      .set(
        'maxBonus',
        number(['maxBonus'], 'Max Bonus', {
          section: EQUIPMENT_SECTIONS.properties,
          order: 80,
          constraints: { minimum: 0 }
        })
      )
      .set(
        'armorClass',
        number(['armorClass'], 'Armor Class', {
          section: EQUIPMENT_SECTIONS.properties,
          order: 90,
          showIf: isBaseEquipment,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'contains',
        groupArray(['contains'], 'Contains', () => CONTAINS_NODE_MAP, {
          presentation: 'inline',
          section: EQUIPMENT_SECTIONS.contents,
          order: 10,
          showIf: isBaseEquipment,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'features',
        groupArray(['features'], 'Features', () => EQUIPMENT_FEATURE_NODE_MAP, {
          presentation: 'branch',
          section: EQUIPMENT_SECTIONS.features,
          order: 10
        })
      )
      .set(
        'restrictions',
        groupObject(['restrictions'], 'Restrictions', () => EQUIPMENT_RESTRICTIONS_NODE_MAP, {
          presentation: 'inline',
          section: EQUIPMENT_SECTIONS.basics,
          order: 50,
          authoring: {
            actions: [
              {
                type: 'collection.add',
                label: 'Add',
                presentation: AUTHORING_ACTION_PRESENTATIONS.button
              }
            ]
          }
        })
      )
      .set(
        'requiresAttunement',
        toggle(['requiresAttunement'], 'Requires Attunement', {
          section: EQUIPMENT_SECTIONS.basics,
          order: 60
        })
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
            options: EQUIPMENT_CATEGORY_OPTIONS
          },
          { section: EQUIPMENT_SECTIONS.properties, order: 10 }
        )
      )
      .set(
        'parentEquipmentId',
        selectSingle(
          ['parentEquipmentId'],
          'Parent Equipment',
          {
            kind: 'DATA',
            relationship: table('equipment', {
              selectColumns: ['id', 'label']
            })
          },
          {
            section: EQUIPMENT_SECTIONS.properties,
            order: 60,
            showIf: isVariant,
            requiredIf: isVariant,
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'properties',
        selectMulti(
          ['properties'],
          'Properties',
          {
            kind: 'INLINE_GROUPS',
            optionGroups: equipmentPropertyOptionGroups
          },
          { section: EQUIPMENT_SECTIONS.properties, order: 70 }
        )
      )
  }
)
