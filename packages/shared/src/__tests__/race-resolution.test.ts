import { describe, expect, it } from 'vitest'

import type { BaseRaceAuthored, SubraceAuthored } from '#authored'
import { RACE_CATEGORY_CODE, RACE_SELECTION_MODE } from '#core'
import { resolveRaceAuthored } from '#compilers'

describe('resolveRaceAuthored', () => {
  it('preserves the subrace authored status while inheriting parent rules', () => {
    const parent: BaseRaceAuthored = {
      id: 'race-parent',
      label: 'Elf',
      status: 'ACTIVE',
      category: RACE_CATEGORY_CODE.BASE,
      selectionMode: RACE_SELECTION_MODE.REQUIRES_SUBRACE,
      size: 'MEDIUM',
      speeds: [{ speedId: 'walking', amount: 30, unit: 'FEET' }],
      userId: 'user-1',
      systemId: 'system-1'
    }
    const subrace: SubraceAuthored = {
      id: 'race-child',
      label: 'High Elf',
      status: 'DRAFT',
      category: RACE_CATEGORY_CODE.SUBRACE,
      parentRaceId: parent.id,
      userId: 'user-1',
      systemId: 'system-1'
    }

    const resolved = resolveRaceAuthored(subrace, (id) => (id === parent.id ? parent : null))

    expect(resolved.status).toBe('DRAFT')
    expect(resolved.size).toBe('MEDIUM')
  })
})
