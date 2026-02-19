import { CHARGE_NODE_MAP, EFFECT_NODE_MAP, FEATURE_NODE_MAP } from '../../../../dist/maps/maps.js'
import { FEATURE_CATEGORY_REGISTRY } from '#core'
import type { NodeMap } from '#util'

export type FeatNodePayloads = {
  features: { featureIds?: string[] }
}

export const FEAT_NODE_MAP: NodeMap<FeatNodePayloads> = {
  features: {
    kind: 'BRANCH',
    meta: {
      ...FEATURE_CATEGORY_REGISTRY.FEATURE,
      label: 'Features'
    },
    enables: {
      kind: 'PATH',
      map: FEATURE_NODE_MAP
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'BRIDGE',
          table: 'feat_features',
          parentColumn: 'feat_id',
          childColumn: 'feature_id'
        },
        selection: 'MULTI_OPTIONAL',
        order: 0
      }
    ]
  },
  charges: {
    kind: 'BRANCH',
    enables: {
      kind: 'PATH',
      map: CHARGE_NODE_MAP
    }
  },
  effects: {
    kind: 'BRANCH',
    enables: {
      kind: 'PATH',
      map: EFFECT_NODE_MAP
    }
  }
}
