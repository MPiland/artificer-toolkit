import { buildNodeMap } from '#utils'

/** One row of an authored list of effect ids. */
export const EFFECT_ID_NODE_MAP = buildNodeMap<{ value: string }>().define(
  'effectId',
  ({ map, nodes }) => {
    map.set('value', nodes.text(['value'], 'Effect ID'))
  }
)
