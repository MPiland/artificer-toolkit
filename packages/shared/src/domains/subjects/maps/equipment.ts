import { type NodeMap } from '#util'
import type { CostAuthored, EquipmentAuthored, EquipmentVariantAuthored, WeightAuthored } from '#authored'
import { EQUIPMENT_ATTRIBUTE_OPTIONS, MEASUREMENT_UNIT_OPTIONS } from '#core'
import { CHARGE_NODE_MAP } from '../../../../dist/maps/maps.js'
import { Merge } from 'type-fest'

export const WEIGHT_NODE_MAP: NodeMap<WeightAuthored> = {
  amount: {
    id: 'amount',
    label: 'Amount',
    input: {
      type: 'NUMBER'
    }
  },
  unit: {
    id: 'unit',
    label: 'Currency',
    input: {
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: MEASUREMENT_UNIT_OPTIONS
      }
    }
  }
}

export const COST_NODE_MAP: NodeMap<CostAuthored> = {
  amount: {
    id: 'amount',
    label: 'Amount',
    input: {
      type: 'NUMBER'
    }
  },
  currencyId: {
    id: 'currencyId',
    label: 'Currency',
    input: {
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'currencies'
        }
      }
    }
  }
}

export const EQUIPMENT_NODE_MAP: NodeMap<Merge<EquipmentVariantAuthored, EquipmentAuthored>> = {
  label: {
    id: 'label',
    label: 'Label',
    input: { type: 'TEXT' }
  },
  description: {
    id: 'description',
    label: 'Description',
    input: { type: 'TEXT' }
  },
  attributes: {
    id: 'attributes',
    label: 'Attributes',
    input: {
      type: 'multi-select-optional',
      source: {
        kind: 'INLINE',
        options: EQUIPMENT_ATTRIBUTE_OPTIONS
      }
    }
  },
  quote: {
    id: 'quote',
    label: 'Quote',
    input: { type: 'richText' }
  },
  cost: {
    id: 'cost',
    nodes: COST_NODE_MAP
  },
  weight: {
    id: 'weight',
    nodes: WEIGHT_NODE_MAP
  },
  charges: {
    id: 'charges',
    nodes: CHARGE_NODE_MAP
  }
}
