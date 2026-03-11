import { FEATURE_ATTRIBUTE_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'
import type { FeatureAuthored } from '#authored'
import { EFFECT_NODE_MAP, CHARGE_NODE_MAP } from '#maps'

const feature = buildNodeMap<FeatureAuthored>()

export const FEATURE_NODE_MAP = feature.define((map, { local }) => map({
  description: {
    label: 'Description',
    kind: 'INPUT',
    type: 'TEXT'
  },
  attributes: {
    label: 'Attributes',
    kind: 'INPUT',
    type: 'SELECT_SINGLE',
    source: {
      kind: 'INLINE',
      options: FEATURE_ATTRIBUTE_OPTIONS
    }
  },
  detail: {
    label: 'Detail',
    kind: 'INPUT',
    type: 'TEXT'
  },
  effects: {
    kind: 'GROUP',
    nodes: EFFECT_NODE_MAP
  },
  charges: {
    kind: 'GROUP',
    showIf: local('attributes').contains('LIMITED_USE'),
    nodes: CHARGE_NODE_MAP
  }
}))
