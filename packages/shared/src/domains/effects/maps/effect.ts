import type {
  EffectAuthored
} from '#authored'
import { buildNodeMap, type NodeMap } from '#utils'
import { INVOCATION_NODE_MAP } from './invocation.js'
import { MANIFEST_BEHAVIOR_NODE_MAP, PATH_NODE_MAP } from './path.js'

export const effect = buildNodeMap<EffectAuthored>()

type EffectNodeMap = NodeMap<EffectAuthored>

export const EFFECT_NODE_MAP: EffectNodeMap = effect.define('effect', ({ map, nodes }) => {
  const { text, number, groupObject, groupArray } = nodes
  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order'))
    .set('invocation', groupObject(['invocation'], 'How It Starts', () => INVOCATION_NODE_MAP, {
      requiredIf: true
    }))
    .set('paths', groupArray(['paths'], 'Outcome Paths', () => PATH_NODE_MAP))
})

export { INVOCATION_NODE_MAP } from './invocation.js'
export { MANIFEST_BEHAVIOR_NODE_MAP } from './path.js'
export { MANIFEST_BEHAVIOR_NODE_MAP as MANIFEST_NESTED_EFFECT_NODE_MAP } from './path.js'

