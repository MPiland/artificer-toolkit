import { CHARGE_NODE_MAP, EFFECT_NODE_MAP } from '../../../../dist/maps/maps.js'
import type { NodeMap } from '#util'
import type { EmptyObject } from 'type-fest'

export type OptionNodePayloads = EmptyObject

export const OPTION_NODE_MAP: NodeMap<OptionNodePayloads> = {
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
