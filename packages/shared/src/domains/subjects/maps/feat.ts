import { EFFECT_NODE_MAP, CHARGE_NODE_MAP, FACET_NODE_MAP, FEATURE_NODE_MAP, FEATURE_GRANTS_NODE_MAP } from '#maps'
import { buildNodeMap, type NodeMap } from '#utils'
import type { FacetAuthored, FeatAuthored } from '#authored'

const featNode = buildNodeMap<FeatAuthored>()
const FEAT_PREREQUISITES_NODE_MAP = FACET_NODE_MAP as NodeMap<FacetAuthored<'CHARACTER'>>

const FEAT_SECTIONS = {
  basics: { id: 'basics', label: 'Basics', order: 10 },
  requirements: { id: 'requirements', label: 'Requirements', order: 20 },
  mechanics: { id: 'mechanics', label: 'Mechanics', order: 30 },
  features: { id: 'features', label: 'Features', order: 40 }
} as const

export const FEAT_NODE_MAP = featNode.define('feat', ({ map, nodes }) => {
  const { text, groupArray, groupObject } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Name', { section: FEAT_SECTIONS.basics, order: 10 }))
    .set('description', text(['description'], 'Description', { section: FEAT_SECTIONS.basics, order: 20 }))
    .set('detail', text(['detail'], 'Detail', { section: FEAT_SECTIONS.basics, order: 30 }))
    .set('prerequisites', groupObject(['prerequisites'], 'Prerequisites', () => FEAT_PREREQUISITES_NODE_MAP, { section: FEAT_SECTIONS.requirements, order: 10 }))
    .set('effects', groupArray(['effects'], 'Effects', () => EFFECT_NODE_MAP, { section: FEAT_SECTIONS.mechanics, order: 10 }))
    .set('charges', groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, { section: FEAT_SECTIONS.mechanics, order: 20 }))
    .set('grants', groupObject(['grants'], 'Grants', () => FEATURE_GRANTS_NODE_MAP, { section: FEAT_SECTIONS.mechanics, order: 30 }))
    .set('features', groupArray(['features'], 'Features', () => FEATURE_NODE_MAP, { section: FEAT_SECTIONS.features, order: 10 }))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
})

