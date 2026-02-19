import { CHARGE_NODE_MAP } from '../../../../dist/maps/maps.js'
import { FEATURE_ATTRIBUTE_OPTIONS, FEATURE_ATTRIBUTE_REGISTRY } from '#core'
import type { NodeMap } from '#util'
import type { FeatureAuthored } from '#authored'

export const FEATURE_NODE_MAP: NodeMap<FeatureAuthored> = {
  attributes: {
    id: 'attributes',
    label: 'Attributes',
    input: {
      type: 'multi-select-optional',
      source: {
        kind: 'INLINE',
        options: FEATURE_ATTRIBUTE_OPTIONS
      }
    }
  },
  charges: {
    id: 'charges',
    nodes: CHARGE_NODE_MAP,
    showIf: {
      field: 'attributes',
      op: 'contains',
      value: typeof FEATURE_ATTRIBUTE_REGISTRY.LIMITED_USE
    }
  }
} as const
