import type { DetailAuthored } from '#authored'
import { buildNodeMap } from '#utils'

const detailNode = buildNodeMap<DetailAuthored>()

export const DETAIL_NODE_MAP = detailNode.define('detail', ({ map, nodes }) => {
  const { text, richText, number } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', richText(['description'], 'Description'))
    .set('order', number(['order'], 'Order'))
})
