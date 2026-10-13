import { describe, expect, it } from 'vitest'

import { SENSE_RANGE_KINDS } from '#core'
import { SENSE_RANGE_NODE_MAP } from '#maps'

describe('SENSE_RANGE_NODE_MAP', () => {
  it('offers only the fields a sense range uses', () => {
    expect(Object.keys(SENSE_RANGE_NODE_MAP.nodes).sort()).toEqual(['amount', 'rangeKind', 'unit'])
  })

  it('offers exactly the sense range kinds', () => {
    const kindNode = SENSE_RANGE_NODE_MAP.nodes.rangeKind
    if (
      kindNode.kind !== 'INPUT' ||
      kindNode.type !== 'SELECT_SINGLE' ||
      kindNode.source.kind !== 'INLINE_OPTIONS'
    ) {
      throw new Error('Expected the sense range kind to be an inline option select.')
    }
    expect(kindNode.source.options.map((option) => option.code)).toEqual([...SENSE_RANGE_KINDS])
  })
})
