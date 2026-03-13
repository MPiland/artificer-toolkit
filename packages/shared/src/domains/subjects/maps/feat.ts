import { CHARGE_NODE_MAP, EFFECT_NODE_MAP, FEATURE_NODE_MAP } from '#maps'
import { FEATURE_CATEGORY_REGISTRY } from '#core'
import { buildNodeMap, type NodeMap } from '#utils'
import type { FeatAuthored } from '#authored'

// Feat Node Map - Complete map with all FeatAuthored properties
const featNode = buildNodeMap<FeatAuthored>()
export const FEAT_NODE_MAP = featNode.define('feat', ({ map, nodes }) => {
  const { text } = nodes
  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('detail', text(['detail'], 'Detail'))
})
