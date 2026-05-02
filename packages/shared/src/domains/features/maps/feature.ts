import { FEATURE_ATTRIBUTE_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'
import type { FeatureAuthored, FeatureOptionChoice } from '#authored'
import { EFFECT_NODE_MAP, CHARGE_NODE_MAP, FACET_NODE_MAP, FEATURE_GRANTS_NODE_MAP } from '#maps'
import { OPTION_NODE_MAP } from './option.js'

const optionChoice = buildNodeMap<FeatureOptionChoice>()

const FEATURE_OPTION_CHOICE_NODE_MAP = optionChoice.define('featureOptionChoice', ({ map, nodes }) => {
  const { number } = nodes

  map
    .set('level', number(['level'], 'Level'))
    .set('count', number(['count'], 'Count'))
    .set('replaceCount', number(['replaceCount'], 'Replace Count'))
})

const feature = buildNodeMap<FeatureAuthored>()

const FEATURE_BASICS_SECTIONS = {
  basics: { id: 'basics', label: 'Feature Basics', order: 10 }
} as const

export const FEATURE_BASICS_NODE_MAP = feature.define('featureBasics', ({ map, nodes }) => {
  const { text, number } = nodes

  map
    .set('label', text(['label'], 'Name', { section: FEATURE_BASICS_SECTIONS.basics, order: 10 }))
    .set('description', text(['description'], 'Description', { section: FEATURE_BASICS_SECTIONS.basics, order: 20 }))
    .set('order', number(['order'], 'Order', { section: FEATURE_BASICS_SECTIONS.basics, order: 30 }))
})

export const FEATURE_NODE_MAP = feature.define('feature', ({ map, nodes, cond }) => {
  const { text, selectMulti, groupArray, groupObject, number } = nodes
  const local = cond.local()

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Name', { section: FEATURE_BASICS_SECTIONS.basics, order: 10 }))
    .set('description', text(['description'], 'Description', { section: FEATURE_BASICS_SECTIONS.basics, order: 20 }))
    .set('attributes', selectMulti(['attributes'], 'Attributes', {
      kind: 'INLINE',
      options: FEATURE_ATTRIBUTE_OPTIONS
    }))
    .set('detail', text(['detail'], 'Detail'))
    .set('effects', groupArray(['effects'], 'Effects', () => EFFECT_NODE_MAP))
    .set('charges', groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, {
      showIf: local.field(['attributes']).contains(['LIMITED_USE'])
    }))
    .set('grants', groupObject(['grants'], 'Grants', () => FEATURE_GRANTS_NODE_MAP))
    .set('restrictions', groupObject(['restrictions'], 'Restrictions', () => FACET_NODE_MAP))
    .set('order', number(['order'], 'Order', { section: FEATURE_BASICS_SECTIONS.basics, order: 30 }))
    .set('availableAtLevel', number(['availableAtLevel'], 'Available At Level'))
    .set('optionChoices', groupArray(['optionChoices'], 'Option Choices', () => FEATURE_OPTION_CHOICE_NODE_MAP))
    .set('options', groupArray(['options'], 'Options', () => OPTION_NODE_MAP))
})

