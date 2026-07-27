import type {
  StartingEquipmentSetAuthored,
  StartingEquipmentAuthored,
  StartingEquipmentGroupAuthored,
  StartingEquipmentOptionAuthored,
  StartingEquipmentCurrencyAuthored,
  StartingEquipmentItemAuthored
} from '#authored'
import {
  AUTHORING_MODE_KIND_OPTIONS,
  AUTHORING_SELECTION_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_PROPERTY_REGISTRY,
  PROPERTIES_BY_CATEGORY,
  STARTING_EQUIPMENT_KIND_OPTIONS
} from '#core'
import { AUTHORING_ACTION_PRESENTATIONS, buildNodeMap, buildRegistryOptionGroups } from '#utils'
import { CHARACTER_FACET_NODE_MAP } from './facet.js'

const startingEquipmentOptionCurrency = buildNodeMap<StartingEquipmentCurrencyAuthored>()

export const STARTING_EQUIPMENT_CURRENCY_NODE_MAP = startingEquipmentOptionCurrency.define(
  'startingEquipmentCurrency',
  ({ map, nodes }) => {
    const { number, selectSingle } = nodes
    map
      .set(
        'currencyId',
        selectSingle(
          ['currencyId'],
          'Currency',
          {
            kind: 'DATA',
            relationship: {
              kind: 'TABLE',
              table: 'currencies'
            }
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'amount',
        number(['amount'], 'Amount', {
          order: 2,
          requiredIf: true
        })
      )
  }
)

const startEquipmentItem = buildNodeMap<StartingEquipmentItemAuthored>()

export const STARTING_EQUIPMENT_ITEM_NODE_MAP = startEquipmentItem.define(
  'startingEquipmentItem',
  ({ map, logic, cond, nodes, data }) => {
    const local = cond.local()
    const { selectSingle, number, selectMulti, groupArray } = nodes
    const { condition } = data
    const { and, not } = logic
    const isEquipment = local.field(['startingEquipmentKind']).eq('EQUIPMENT')

    const equipmentPropertyOptionGroups = buildRegistryOptionGroups(
      EQUIPMENT_PROPERTY_REGISTRY,
      PROPERTIES_BY_CATEGORY,
      (category) => local.field(['category']).eq(category),
      local.field(['category']).empty()
    )

    map
      .set(
        'startingEquipmentKind',
        selectSingle(
          ['startingEquipmentKind'],
          'Equipment Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: STARTING_EQUIPMENT_KIND_OPTIONS
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'selectionKind',
        selectSingle(
          ['selectionKind'],
          'Selection Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: AUTHORING_SELECTION_OPTIONS
          },
          {
            order: 2,
            requiredIf: true,
            showIf: isEquipment
          }
        )
      )
      .set(
        'quantity',
        number(['quantity'], 'Quantity', {
          order: 3,
          requiredIf: true,
          showIf: and([isEquipment, local.field(['selectionKind']).eq('GRANTED')])
        })
      )
      .set(
        'count',
        number(['count'], 'Count', {
          order: 3,
          requiredIf: true,
          showIf: and([isEquipment, local.field(['selectionKind']).eq('CHOSEN')])
        })
      )
      .set(
        'authoringModeKind',
        selectSingle(
          ['authoringModeKind'],
          'Authoring Mode',
          {
            kind: 'INLINE_OPTIONS',
            options: AUTHORING_MODE_KIND_OPTIONS
          },
          {
            order: 3,
            showIf: isEquipment
          }
        )
      )
      .set(
        'category',
        selectSingle(
          ['category'],
          'Category',
          {
            kind: 'INLINE_OPTIONS',
            options: EQUIPMENT_CATEGORY_OPTIONS,
            filter: {
              kind: 'ALLOW',
              by: condition((c) =>
                c
                  .if(not(local.field(['properties']).empty()))
                  .then((o) =>
                    o.chain((s) =>
                      s
                        .input('equipment_properties', {
                          whereColumn: 'property_code',
                          valueColumn: 'equipment_id',
                          input: local.id(['properties'])
                        })
                        .mapValues('equipment', {
                          whereColumn: 'id',
                          valueColumn: 'category'
                        })
                        .end()
                    )
                  )
                  .else((o) =>
                    o.chain((s) =>
                      s
                        .seed('equipment', {
                          valueColumn: 'category'
                        })
                        .end()
                    )
                  )
                  .end()
              )
            }
          },
          {
            order: 4,
            showIf: isEquipment
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
          {
            order: 5,
            showIf: isEquipment
          }
        )
      )
      .set(
        'equipmentIds',
        selectMulti(
          ['equipmentIds'],
          'Equipment',
          {
            kind: 'DATA',
            relationship: condition((c) =>
              c
                .if(
                  logic.and([
                    not(local.field(['properties']).empty()),
                    not(local.field(['category']).empty())
                  ])
                )
                .then((o) =>
                  o.chain((s) =>
                    s
                      .input('equipment_properties', {
                        whereColumn: 'property_code',
                        valueColumn: 'equipment_id',
                        input: local.id(['properties'])
                      })
                      .mapValues('equipment', {
                        whereColumn: 'id',
                        valueColumn: 'id',
                        selectColumns: ['id', 'label'],
                        where: (col) => col('category').in(local.id(['category']))
                      })
                      .end()
                  )
                )
                .elseIf(not(local.field(['properties']).empty()))
                .then((o) =>
                  o.chain((s) =>
                    s
                      .input('equipment_properties', {
                        whereColumn: 'property_code',
                        valueColumn: 'equipment_id',
                        input: local.id(['properties'])
                      })
                      .mapValues('equipment', {
                        whereColumn: 'id',
                        valueColumn: 'id',
                        selectColumns: ['id', 'label']
                      })
                      .end()
                  )
                )
                .elseIf(not(local.field(['category']).empty()))
                .then((o) =>
                  o.mapValues('equipment', {
                    whereColumn: 'category',
                    valueColumn: 'id',
                    selectColumns: ['id', 'label'],
                    input: local.id(['category'])
                  })
                )
                .else((o) =>
                  o.table('equipment', {
                    selectColumns: ['id', 'label']
                  })
                )
                .end()
            )
          },
          {
            showIf: and([isEquipment, local.field(['authoringModeKind']).eq('SELECTED')])
          }
        )
      )
      .set(
        'currencies',
        groupArray(['currencies'], 'Currencies', () => STARTING_EQUIPMENT_CURRENCY_NODE_MAP, {
          presentation: 'inline',
          order: 3,
          showIf: local.field(['startingEquipmentKind']).eq('CURRENCY')
        })
      )
  }
)

const startingEquipmentOption = buildNodeMap<StartingEquipmentOptionAuthored>()

export const STARTING_EQUIPMENT_OPTION_NODE_MAP = startingEquipmentOption.define(
  'startingEquipmentOption',
  ({ map, nodes }) => {
    const { groupArray, groupObject } = nodes

    map
      .set(
        'eligibility',
        groupObject(['eligibility'], 'Eligibility', () => CHARACTER_FACET_NODE_MAP, {
          presentation: 'branch',
          order: 1,
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
        'items',
        groupArray(['items'], 'Items', () => STARTING_EQUIPMENT_ITEM_NODE_MAP, {
          presentation: 'inline',
          order: 2
        })
      )
  }
)

const startingEquipmentGroup = buildNodeMap<StartingEquipmentGroupAuthored>()

export const STARTING_EQUIPMENT_GROUP_NODE_MAP = startingEquipmentGroup.define(
  'startingEquipmentGroup',
  ({ map, nodes }) => {
    const { groupArray } = nodes

    map.set(
      'options',
      groupArray(['options'], 'Options', () => STARTING_EQUIPMENT_OPTION_NODE_MAP, {
        presentation: 'branch'
      })
    )
  }
)

const startingEquipmentSet = buildNodeMap<StartingEquipmentSetAuthored>()

export const STARTING_EQUIPMENT_SET_NODE_MAP = startingEquipmentSet.define(
  'startingEquipmentSet',
  ({ map, nodes }) => {
    const { groupArray } = nodes

    map.set(
      'groups',
      groupArray(['groups'], 'Groups', () => STARTING_EQUIPMENT_GROUP_NODE_MAP, {
        presentation: 'branch'
      })
    )
  }
)

const startingEquipment = buildNodeMap<StartingEquipmentAuthored>()

export const STARTING_EQUIPMENT_NODE_MAP = startingEquipment.define(
  'startingEquipment',
  ({ map, nodes }) => {
    const { groupArray } = nodes
    map.set(
      'sets',
      groupArray(['sets'], 'Sets', () => STARTING_EQUIPMENT_SET_NODE_MAP, {
        presentation: 'branch'
      })
    )
  }
)
