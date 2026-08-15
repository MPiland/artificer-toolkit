import { describe, expect, it } from 'vitest'

import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey
} from '../domains/character/sheetResource.js'

describe('character authored-source resource owners', () => {
  it('keeps distinct acquired sources separate for the same charge', () => {
    const first = toCharacterResourceOwnerKey({
      kind: 'AUTHORED_SOURCE',
      chargeId: 'action-surge-charge',
      source: {
        kind: 'AUTHORED',
        sourceKind: 'FEATURE',
        definitionId: 'action-surge',
        sourceInstanceId: 'acquisition-1'
      }
    })
    const second = toCharacterResourceOwnerKey({
      kind: 'AUTHORED_SOURCE',
      chargeId: 'action-surge-charge',
      source: {
        kind: 'AUTHORED',
        sourceKind: 'FEATURE',
        definitionId: 'action-surge',
        sourceInstanceId: 'acquisition-2'
      }
    })

    expect(first).toEqual({
      kind: 'AUTHORED_SOURCE',
      sourceId: 'AUTHORED:FEATURE:action-surge:acquisition-1',
      chargeId: 'action-surge-charge'
    })
    expect(createCharacterResourceOwnerKey(first)).toBe(
      'AUTHORED_SOURCE:AUTHORED:FEATURE:action-surge:acquisition-1:action-surge-charge'
    )
    expect(createCharacterResourceOwnerKey(first)).not.toBe(createCharacterResourceOwnerKey(second))
  })

  it('keeps a choice-heavy authored source key within the rule identity bound', () => {
    const owner = toCharacterResourceOwnerKey({
      kind: 'AUTHORED_SOURCE',
      chargeId: '00000000-0000-0000-a001-000511020000',
      source: {
        kind: 'AUTHORED',
        sourceKind: 'ANCESTRY',
        definitionId: '00000000-0000-0000-a001-000511010000',
        sourceInstanceId:
          'ANCESTRY:00000000-0000-0000-a001-000509010000:00000000-0000-0000-a001-0005aa010000:00000000-0000-0000-a001-000511010000'
      }
    })
    const key = createCharacterResourceOwnerKey(owner)

    expect(key).toHaveLength(233)
    expect(key).not.toContain('%253A')
  })
})
