import { describe, expect, it } from 'vitest'

import { getExplicitSpellCastLevels } from '../character/sheetProjection.js'
import type { SheetSpellSource } from '../character/sheetCommandReducer.js'

const source = { source: { kind: 'CLASS', classId: 'wizard' } } as unknown as SheetSpellSource

describe('the levels a spell is cast at', () => {
  it('offers each owned level its projectile count changes at, beside the spell’s own', () => {
    const magicMissile = {
      level: 1,
      mechanics: [{ targetCountLevels: [1, 2, 3, 4], outcomes: [{ kind: 'DAMAGE' }] }]
    }
    expect(getExplicitSpellCastLevels(magicMissile, source, new Set([1, 3]))).toEqual([1, 3])
  })

  it('offers only its own level when nothing about the spell scales', () => {
    const light = { level: 1, mechanics: [{ outcomes: [{ kind: 'DAMAGE' }] }] }
    expect(getExplicitSpellCastLevels(light, source, new Set([1, 2]))).toEqual([1])
  })
})
