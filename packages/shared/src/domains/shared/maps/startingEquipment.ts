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
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_PROPERTY_OPTIONS,
  STARTING_EQUIPMENT_KIND_OPTIONS
} from '#core'
import { buildNodeMap, type NodeMap } from '#util'

const startingEquipmentOptionCurrency = buildNodeMap<StartingEquipmentCurrencyAuthored>()

export const STARTING_EQUIPMENT_CURRENCY_NODE_MAP
  = startingEquipmentOptionCurrency.define((map) => map({
    currencyId: {
      kind: 'INPUT',
      label: 'Currency',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'currencies'
        }
      }
    },
    amount: {
      kind: 'INPUT',
      label: 'Amount',
      type: 'NUMBER'
    }
  }))

const startEquipmentItem = buildNodeMap<StartingEquipmentItemAuthored>()

export const STARTING_EQUIPMENT_ITEM_NODE_MAP
  = startEquipmentItem.define((map, { and, field }) => map({
    startingEquipmentKind: {
      kind: 'INPUT',
      label: 'Equipment Kind',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: STARTING_EQUIPMENT_KIND_OPTIONS
      }
    },
    category: {
      kind: 'INPUT',
      label: 'Equipment Category',
      type: 'SELECT_SINGLE',
      source: {
        kind: 'INLINE',
        options: EQUIPMENT_CATEGORY_OPTIONS
      },
      showIf: field('startingEquipmentKind').eq('EQUIPMENT')
    },
    properties: {
      kind: 'INPUT',
      label: 'Equipment Properties',
      type: 'SELECT_SINGLE',
      source: {
        kind: 'INLINE',
        options: EQUIPMENT_PROPERTY_OPTIONS
      },
      showIf: field('startingEquipmentKind').eq('EQUIPMENT')
    },
    authoringModeKind: {
      kind: 'INPUT',
      label: 'Authoring Mode',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: AUTHORING_MODE_KIND_OPTIONS
      },
      showIf: field('startingEquipmentKind').eq('EQUIPMENT')
    },
    equipmentIds: {
      kind: 'INPUT',
      label: 'Equipment',
      type: 'SELECT_MULTI',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'equipment'
        }
      },
      showIf: and([
        field('startingEquipmentKind').eq('EQUIPMENT'),
        field('authoringModeKind').eq('SELECTED')
      ])
    },
    currencies: {
      kind: 'GROUP',
      nodes: STARTING_EQUIPMENT_CURRENCY_NODE_MAP,
      showIf: field('startingEquipmentKind').eq('CURRENCY')
    }
  }))

const startingEquipmentOption = buildNodeMap<StartingEquipmentOptionAuthored>()

export const STARTING_EQUIPMENT_OPTION_NODE_MAP
  = startingEquipmentOption.define((map) => map({
    items: {
      kind: 'GROUP',
      nodes: STARTING_EQUIPMENT_ITEM_NODE_MAP
    }
  }))

const startingEquipmentGroup = buildNodeMap<StartingEquipmentGroupAuthored>()

type StartingEquipmentGroupNodeMap = NodeMap<StartingEquipmentGroupAuthored>

export const STARTING_EQUIPMENT_GROUP_NODE_MAP: StartingEquipmentGroupNodeMap
  = startingEquipmentGroup.define((map) => map({
    options: {
      kind: 'GROUP',
      nodes: STARTING_EQUIPMENT_OPTION_NODE_MAP
    }
  }))

const startingEquipmentSet = buildNodeMap<StartingEquipmentSetAuthored>()

type StartingEquipmentSetNodeMap = NodeMap<StartingEquipmentSetAuthored>

export const STARTING_EQUIPMENT_SET_NODE_MAP: StartingEquipmentSetNodeMap
  = startingEquipmentSet.define((map) => map({
    groups: {
      kind: 'GROUP',
      nodes: STARTING_EQUIPMENT_GROUP_NODE_MAP
    }
  }))

const startingEquipment = buildNodeMap<StartingEquipmentAuthored>()

type StartingEquipmentNodeMap = NodeMap<StartingEquipmentAuthored>

export const STARTING_EQUIPMENT_NODE_MAP: StartingEquipmentNodeMap = startingEquipment.define((map) => map({
  sets: {
    kind: 'GROUP',
    nodes: STARTING_EQUIPMENT_SET_NODE_MAP
  }
}))
