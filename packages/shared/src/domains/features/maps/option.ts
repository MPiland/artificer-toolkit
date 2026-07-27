import type { OptionAuthored } from '#authored'
import { FEATURE_ATTRIBUTE_OPTIONS } from '#core'
import {
  EFFECT_NODE_MAP,
  CHARGE_NODE_MAP,
  FACET_NODE_MAP,
  FEATURE_GRANTS_NODE_MAP,
  DETAIL_NODE_MAP
} from '#maps'
import { AUTHORING_ACTION_PRESENTATIONS, buildNodeMap } from '#utils'

const option = buildNodeMap<OptionAuthored>()

const OPTION_STEPS = {
  basics: { id: 'basics', label: 'Basics', order: 10 },
  mechanics: { id: 'mechanics', label: 'Mechanics', order: 20 },
  grants: { id: 'grants', label: 'Grants', order: 30 }
} as const

const OPTION_SECTIONS = {
  basics: { id: 'basics', label: 'Option Basics', order: 10, step: OPTION_STEPS.basics },
  effects: { id: 'effects', label: 'Effects', order: 10, step: OPTION_STEPS.mechanics },
  usage: { id: 'usage', label: 'Usage', order: 20, step: OPTION_STEPS.mechanics },
  restrictions: {
    id: 'restrictions',
    label: 'Restrictions',
    order: 30,
    step: OPTION_STEPS.mechanics
  },
  grants: { id: 'grants', label: 'Grants', order: 10, step: OPTION_STEPS.grants }
} as const

export const OPTION_NODE_MAP = option.define('option', ({ map, nodes, cond }) => {
  const { text, richText, selectMulti, groupArray, groupObject, number } = nodes
  const local = cond.local()

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label', { section: OPTION_SECTIONS.basics, order: 10 }))
    .set(
      'description',
      richText(['description'], 'Description', { section: OPTION_SECTIONS.basics, order: 20 })
    )
    .set(
      'attributes',
      selectMulti(
        ['attributes'],
        'Attributes',
        {
          kind: 'INLINE_OPTIONS',
          options: FEATURE_ATTRIBUTE_OPTIONS
        },
        { section: OPTION_SECTIONS.basics, order: 30 }
      )
    )
    .set(
      'details',
      groupArray(['details'], 'Details', () => DETAIL_NODE_MAP, {
        presentation: 'inline',
        section: OPTION_SECTIONS.basics,
        order: 40
      })
    )
    .set('order', number(['order'], 'Order', { section: OPTION_SECTIONS.basics, order: 50 }))
    .set(
      'effects',
      groupArray(['effects'], 'Effects', () => EFFECT_NODE_MAP, {
        presentation: 'branch',
        section: OPTION_SECTIONS.effects,
        order: 10
      })
    )
    .set(
      'charges',
      groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, {
        presentation: 'inline',
        section: OPTION_SECTIONS.usage,
        order: 20,
        showIf: local.field(['attributes']).contains(['LIMITED_USE'])
      })
    )
    .set(
      'restrictions',
      groupObject(['restrictions'], 'Restrictions', () => FACET_NODE_MAP, {
        presentation: 'branch',
        section: OPTION_SECTIONS.restrictions,
        order: 30,
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
      'grants',
      groupObject(['grants'], 'Grants', () => FEATURE_GRANTS_NODE_MAP, {
        presentation: 'branch',
        section: OPTION_SECTIONS.grants,
        order: 10
      })
    )
})
