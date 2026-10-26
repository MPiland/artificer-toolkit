import { describe, expect, it } from 'vitest'

import {
  MAX_CHARACTER_CONSEQUENCES,
  characterConsequencesDtoSchema,
  consequenceRollTableDtoSchema
} from '../shared/consequenceRolls.js'

const rowId = (n: number) => `60000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function row(n: number, minimum: number, maximum: number) {
  return {
    id: rowId(n),
    minimum,
    maximum,
    label: `Row ${n}`,
    effect: 'The GM rules what this does.',
    healing: 'The GM rules what heals it.'
  }
}

const accepts = (table: unknown) => consequenceRollTableDtoSchema.safeParse(table).success

describe('Consequence roll tables (ATTACK-15.2)', () => {
  it('accepts ordered rows within the die, leaving gaps between them', () => {
    expect(accepts({ dieFaces: 20, rows: [row(1, 1, 1), row(2, 2, 10), row(3, 15, 20)] })).toBe(
      true
    )
  })

  it('rejects overlapping, out-of-order, out-of-die or inverted rows and repeated ids', () => {
    expect(accepts({ dieFaces: 20, rows: [row(1, 1, 5), row(2, 5, 10)] })).toBe(false)
    expect(accepts({ dieFaces: 20, rows: [row(1, 6, 10), row(2, 1, 5)] })).toBe(false)
    expect(accepts({ dieFaces: 20, rows: [row(1, 1, 21)] })).toBe(false)
    expect(accepts({ dieFaces: 20, rows: [row(1, 5, 4)] })).toBe(false)
    expect(
      accepts({ dieFaces: 20, rows: [row(1, 1, 5), { ...row(2, 6, 10), id: rowId(1) }] })
    ).toBe(false)
    expect(accepts({ dieFaces: 20, rows: [] })).toBe(false)
    expect(accepts({ dieFaces: 101, rows: [row(1, 1, 5)] })).toBe(false)
  })
})

describe('Recorded Character consequences (ATTACK-15.2)', () => {
  const consequence = (n: number) => {
    const { id: _rowId, minimum: _minimum, maximum: _maximum, ...text } = row(n, 1, 1)
    return {
      ...text,
      id: rowId(100 + n),
      definitionId: rowId(200),
      rowId: rowId(n),
      tableLabel: 'Lingering Injuries',
      recordedAt: '2026-10-25T00:00:00.000Z'
    }
  }

  it(`holds at most ${MAX_CHARACTER_CONSEQUENCES} consequences, each a closed record`, () => {
    const full = Array.from({ length: MAX_CHARACTER_CONSEQUENCES }, (_, n) => consequence(n + 1))
    expect(characterConsequencesDtoSchema.safeParse(full).success).toBe(true)
    expect(
      characterConsequencesDtoSchema.safeParse([
        ...full,
        consequence(MAX_CHARACTER_CONSEQUENCES + 1)
      ]).success
    ).toBe(false)
    expect(
      characterConsequencesDtoSchema.safeParse([{ ...consequence(1), automated: true }]).success
    ).toBe(false)
  })
})
