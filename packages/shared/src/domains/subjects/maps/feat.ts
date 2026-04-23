import { EFFECT_NODE_MAP, CHARGE_NODE_MAP, FACET_NODE_MAP, FEATURE_NODE_MAP, FEATURE_GRANTS_NODE_MAP } from '#maps'
import { buildNodeMap, type NodeMap } from '#utils'
import type { FacetAuthored, FeatAuthored } from '#authored'

const featNode = buildNodeMap<FeatAuthored>()
const FEAT_PREREQUISITES_NODE_MAP = FACET_NODE_MAP as NodeMap<FacetAuthored<'CHARACTER'>>

export const FEAT_NODE_MAP = featNode.define('feat', ({ map, nodes }) => {
  const { text, groupArray, groupObject } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('detail', text(['detail'], 'Detail'))
    .set('prerequisites', groupObject(['prerequisites'], 'Prerequisites', () => FEAT_PREREQUISITES_NODE_MAP))
    .set('effects', groupArray(['effects'], 'Effects', () => EFFECT_NODE_MAP))
    .set('charges', groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP))
    .set('grants', groupObject(['grants'], 'Grants', () => FEATURE_GRANTS_NODE_MAP))
    .set('features', groupArray(['features'], 'Features', () => FEATURE_NODE_MAP))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
})

