import type { OptionAuthored } from '#authored'
import { FEATURE_ATTRIBUTE_OPTIONS } from '#core'
import { EFFECT_NODE_MAP, CHARGE_NODE_MAP, FACET_NODE_MAP, FEATURE_GRANTS_NODE_MAP } from '#maps'
import { buildNodeMap } from '#utils'

const option = buildNodeMap<OptionAuthored>()

export const OPTION_NODE_MAP = option.define('option', ({ map, nodes, cond }) => {
  const { text, selectMulti, groupArray, groupObject, number } = nodes
  const local = cond.local()

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
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
    .set('order', number(['order'], 'Order'))
})

