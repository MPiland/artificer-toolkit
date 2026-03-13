import { CHARGE_NODE_MAP, EFFECT_NODE_MAP, FEATURE_NODE_MAP, FEATURE_GRANTS_NODE_MAP } from '#maps'
import { buildNodeMap } from '#utils'
import type { FeatAuthored } from '#authored'

const featNode = buildNodeMap<FeatAuthored>()

export const FEAT_NODE_MAP = featNode.define('feat', ({ map, nodes }) => {
  const { text, groupArray, groupObject } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('detail', text(['detail'], 'Detail'))
    .set('effects', groupArray(['effects'], 'Effects', () => EFFECT_NODE_MAP))
    .set('charges', groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP))
    .set('grants', groupObject(['grants'], 'Grants', () => FEATURE_GRANTS_NODE_MAP))
    .set('features', groupArray(['features'], 'Features', () => FEATURE_NODE_MAP))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
})
