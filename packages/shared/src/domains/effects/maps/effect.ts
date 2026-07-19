import type { EffectAuthored } from '#authored'
import { buildNodeMap } from '#utils'
import { INVOCATION_NODE_MAP } from './invocation.js'
import { PATH_NODE_MAP } from './path.js'

export const effect = buildNodeMap<EffectAuthored>()

export const EFFECT_NODE_MAP = effect.define(
  'effect',
  ({ map, nodes }) => {
    const { text, number, groupObject, groupArray } = nodes
    map
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order'))
      .set(
        'invocation',
        groupObject(['invocation'], 'How It Starts', () => INVOCATION_NODE_MAP, {
          requiredIf: true,
          presentation: 'inline'
        })
      )
    .set(
        'paths',
        groupArray(['paths'], 'Outcome Paths', () => PATH_NODE_MAP, {
          presentation: 'branch'
        })
      )
  },
  {
    collection: {
      rowSummary: 'effect'
    }
  }
)

export { INVOCATION_NODE_MAP } from './invocation.js'
export { MANIFEST_BEHAVIOR_NODE_MAP } from './path.js'
export { MANIFEST_BEHAVIOR_NODE_MAP as MANIFEST_NESTED_EFFECT_NODE_MAP } from './path.js'
