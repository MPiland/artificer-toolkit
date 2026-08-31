import { describe, expect, it } from 'vitest'
import type { DBLike } from '../types/index.js'
import {
  isSystemScopedNodeRuntimeTable,
  selectNodeRuntimeRows,
  type NodeRuntimeQueryWhere
} from '../utils/nodeRuntimeQuery.js'

describe('node runtime query where contract', () => {
  it('applies System filtering to ability definitions', () => {
    expect(isSystemScopedNodeRuntimeTable('ability_definitions')).toBe(true)
  })

  it('rejects legacy property-presence constants', async () => {
    // @ts-expect-error Legacy runtime constants are intentionally unsupported.
    const legacyWhere: NodeRuntimeQueryWhere = { constant: true }

    await expect(
      selectNodeRuntimeRows({} as DBLike, 'equipment', ['id'], legacyWhere)
    ).rejects.toThrow('Unknown node runtime where kind')
  })
})
