import type { SizeRangeAuthored } from '#authored'
import { buildNodeMap } from '#utils'

const sizeRange = buildNodeMap<SizeRangeAuthored>()

/** A closed range of System sizes; the schema requires at least one bound. */
export const SIZE_RANGE_NODE_MAP = sizeRange.define('sizeRange', ({ map, nodes, data }) => {
  const sizeSource = {
    kind: 'DATA' as const,
    relationship: data.table('sizes', { selectColumns: ['id', 'label', 'description'] })
  }

  map
    .set(
      'minimumSizeCode',
      nodes.selectSingle(['minimumSizeCode'], 'Smallest Size', sizeSource, { order: 1 })
    )
    .set(
      'maximumSizeCode',
      nodes.selectSingle(['maximumSizeCode'], 'Largest Size', sizeSource, { order: 2 })
    )
})
