import {
  FEATURE_CATEGORY_REGISTRY,
  RACE_CATEGORY_REGISTRY,
  SIZE_OPTIONS,
  type SizeCode
} from '#core'
import { FEATURE_NODE_MAP } from '../../../../dist/maps/maps.js'
import type { NodeMap } from '#util'

export type BaseRaceNodePayloads = {
  features: { featureIds?: string[] }
  sizes: { sizes: SizeCode[] }
}

export const BASE_RACE_NODE_MAP: NodeMap<BaseRaceNodePayloads> = {
  features: {
    kind: 'BRANCH',
    meta: {
      ...FEATURE_CATEGORY_REGISTRY.FEATURE,
      label: 'Features'
    },
    payload: 'features',
    enables: {
      kind: 'PATH',
      map: FEATURE_NODE_MAP
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'BRIDGE',
          table: 'class_features',
          parentColumn: 'class_id',
          childColumn: 'feature_id'
        },
        selection: 'MULTI_OPTIONAL',
        order: 0
      }
    ]
  },
  sizes: {
    kind: 'BRANCH',
    meta: {
      label: 'Sizes',
      code: 'SIZES',
      tooltip: 'Sizes of the selected race(s).'
    },
    payload: 'sizes',
    options: [
      {
        kind: 'INLINE',
        options: SIZE_OPTIONS,
        selection: 'MULTI_REQUIRED',
        order: 0
      }
    ]
  }
}

export type SubraceNodePayloads = BaseRaceNodePayloads

export const SUBRACE_NODE_MAP: NodeMap<SubraceNodePayloads> = {
  ...BASE_RACE_NODE_MAP
}

export type RaceNodePayloads = BaseRaceNodePayloads & {
  subraces: { subraceIds?: string[] }
}

export const RACE_NODE_PATH: NodeMap<RaceNodePayloads> = {
  ...BASE_RACE_NODE_MAP,
  subraces: {
    kind: 'BRANCH',
    meta: {
      ...RACE_CATEGORY_REGISTRY.SUBRACE,
      label: 'Subraces'
    },
    payload: 'subraces',
    options: [
      {
        kind: 'DATA',
        selection: 'MULTI_OPTIONAL',
        relationship: {
          kind: 'CONDITION',
          table: 'races',
          column: 'category',
          condition: 'SUBRACE'
        },
        order: 0
      }
    ]
  }
}
