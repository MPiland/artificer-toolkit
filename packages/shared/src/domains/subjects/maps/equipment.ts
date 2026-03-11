import { buildNodeMap, type NodeMap } from '#utils'
import type { CostAuthored, EquipmentAuthored, EquipmentVariantAuthored, WeightAuthored } from '#authored'
import { EQUIPMENT_ATTRIBUTE_OPTIONS, MEASUREMENT_UNIT_OPTIONS } from '#core'
import { CHARGE_NODE_MAP } from '../../../../dist/maps/maps.js'
import { Merge } from 'type-fest'

export const WEIGHT_NODE_MAP: NodeMap<WeightAuthored> = {
  amount: {
    label: 'Amount',
    input: {
      type: 'NUMBER'
    }
  },
  unit: {
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
    label: 'Amount',
    input: {
      type: 'NUMBER'
    }
  },
  currencyId: {
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

type MergedEquipment = Merge<EquipmentVariantAuthored, EquipmentAuthored>

const equipment = buildNodeMap<MergedEquipment>()

type EquipmentNodeMap = NodeMap<MergedEquipment>

export const EQUIPMENT_NODE_MAP: EquipmentNodeMap = equipment.define((map) => map({
  label: {
    label: 'Label',
    kind: 'INPUT',
    type: 'TEXT'
  },
  description: {
    label: 'Description',
    kind: 'INPUT',
    type: 'TEXT'
  },
  attributes: {
    label: 'Attributes',
    kind: 'INPUT',
    type: 'SELECT_MULTI',
    source: {
      kind: 'INLINE',
      options: EQUIPMENT_ATTRIBUTE_OPTIONS
    }
  }
}))
