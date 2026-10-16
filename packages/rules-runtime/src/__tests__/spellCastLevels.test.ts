import { describe, expect, it } from 'vitest'

import { getSpellCastLevels } from '../character/sheetProjection.js'
import type { SheetSpellSource } from '../character/sheetCommandReducer.js'

const source = (fields: Record<string, unknown> = {}) =>
  ({ source: { kind: 'CLASS', classId: 'wizard' }, ...fields }) as unknown as SheetSpellSource

describe('the levels a spell is cast at', () => {
  it('offers every owned higher slot level beside the spell’s own, whatever the spell scales', () => {
    expect(getSpellCastLevels({ level: 1 }, source(), new Set([1, 3, 5]))).toEqual([1, 3, 5])
  })

  it('offers only its own level when no higher slot is owned', () => {
    expect(getSpellCastLevels({ level: 3 }, source(), new Set([1, 2, 3]))).toEqual([3])
  })

  it('offers a cantrip and a non-slot cast only at their own level', () => {
    expect(getSpellCastLevels({ level: 0 }, source(), new Set([1, 2]))).toEqual([0])
    expect(
      getSpellCastLevels({ level: 1 }, source({ castMode: 'AT_WILL' }), new Set([1, 2]))
    ).toEqual([1])
    expect(
      getSpellCastLevels(
        { level: 1 },
        source({ castMode: 'SPELL_SLOT', fixedLevel: 4 }),
        new Set([4, 5])
      )
    ).toEqual([4, 5])
  })
})
