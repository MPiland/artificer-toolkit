import {
  EFFECT_NODE_MAP,
  CHARGE_NODE_MAP,
  CHARACTER_FACET_NODE_MAP,
  FEATURE_NODE_MAP,
  FEATURE_GRANTS_NODE_MAP,
  DETAIL_NODE_MAP
} from '#maps'
import { AUTHORING_ACTION_PRESENTATIONS, buildNodeMap, type NodeMap } from '#utils'
import type { FacetAuthored, FeatAuthored } from '#authored'

const featNode = buildNodeMap<FeatAuthored>()
export const FEAT_PREREQUISITES_NODE_MAP = CHARACTER_FACET_NODE_MAP as NodeMap<
  FacetAuthored<'CHARACTER'>
>
export const FEAT_GRANTS_NODE_MAP = FEATURE_GRANTS_NODE_MAP as NodeMap<
  NonNullable<FeatAuthored['grants']>
>

const FEAT_SECTIONS = {
  basics: { id: 'basics', label: 'Basics', order: 10 },
  requirements: { id: 'requirements', label: 'Requirements', order: 20 },
  effects: { id: 'effects', label: 'Effects', order: 30 },
  grants: { id: 'grants', label: 'Grants', order: 40 },
  features: { id: 'features', label: 'Features', order: 50 }
} as const

export const FEAT_NODE_MAP = featNode.define('feat', ({ map, nodes }) => {
  const { text, richText, groupArray, groupObject } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set(
      'label',
      text(['label'], 'Name', {
        section: FEAT_SECTIONS.basics,
        order: 10,
        requiredIf: true
      })
    )
    .set(
      'description',
      richText(['description'], 'Description', { section: FEAT_SECTIONS.basics, order: 20 })
    )
    .set(
      'details',
      groupArray(['details'], 'Details', () => DETAIL_NODE_MAP, {
        presentation: 'inline',
        section: FEAT_SECTIONS.basics,
        order: 30
      })
    )
    .set(
      'prerequisites',
      groupObject(['prerequisites'], 'Prerequisites', () => FEAT_PREREQUISITES_NODE_MAP, {
        presentation: 'branch',
        section: FEAT_SECTIONS.requirements,
        order: 10,
        authoring: {
          actions: [
            {
              type: 'collection.add',
              label: 'Add',
              presentation: AUTHORING_ACTION_PRESENTATIONS.button
            }
          ]
        }
      })
    )
    .set(
      'effects',
      groupArray(['effects'], 'Effects', () => EFFECT_NODE_MAP, {
        presentation: 'branch',
        section: FEAT_SECTIONS.effects,
        order: 10
      })
    )
    .set(
      'charges',
      groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, {
        presentation: 'inline',
        section: FEAT_SECTIONS.basics,
        order: 40
      })
    )
    .set(
      'grants',
      groupObject(['grants'], 'Grants', () => FEAT_GRANTS_NODE_MAP, {
        presentation: 'branch',
        section: FEAT_SECTIONS.grants,
        order: 10
      })
    )
    .set(
      'features',
      groupArray(['features'], 'Features', () => FEATURE_NODE_MAP, {
        presentation: 'branch',
        section: FEAT_SECTIONS.features,
        order: 10
      })
    )
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
})
