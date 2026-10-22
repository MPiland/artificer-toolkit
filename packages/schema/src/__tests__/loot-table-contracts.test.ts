import { describe, expect, it } from 'vitest'
import { LOOT_LIMITS, lootTableSchema } from '../api/lootTables.js'

const id = () => crypto.randomUUID()
const table = (ranges: Array<{ min: number; max: number | null }>) => ({
  id: id(),
  name: 'Guard room',
  ranges: ranges.map((range) => ({ id: id(), ...range, entries: [] }))
})

describe('lootTableSchema', () => {
  it('accepts exclusive ranges with gaps and an open top range', () => {
    expect(
      lootTableSchema.safeParse(
        table([
          { min: 1, max: 5 },
          { min: 8, max: 12 },
          { min: 15, max: null }
        ])
      ).success
    ).toBe(true)
  })

  it('refuses overlapping and inverted ranges with the shared message', () => {
    const overlap = lootTableSchema.safeParse(
      table([
        { min: 5, max: 10 },
        { min: 10, max: 15 }
      ])
    )
    expect(overlap.error?.issues[0]).toMatchObject({
      path: ['ranges'],
      message: expect.stringContaining('LOOT_RANGE_OVERLAP')
    })
    const inverted = lootTableSchema.safeParse(table([{ min: 9, max: 3 }]))
    expect(inverted.error?.issues[0]?.message).toContain('LOOT_RANGE_MIN_GREATER_THAN_MAX')
  })

  it('parses item and coin entries and refuses anything else', () => {
    const entries = [
      { kind: 'ITEM', itemId: id(), quantity: 2 },
      { kind: 'COIN', denominationId: id(), amount: 30 }
    ]
    const parsed = (next: unknown[]) =>
      lootTableSchema.safeParse({
        ...table([{ min: 1, max: 2 }]),
        ranges: [{ id: id(), min: 1, max: 2, entries: next }]
      })
    expect(parsed(entries).success).toBe(true)
    expect(parsed([{ kind: 'ITEM', itemId: id(), quantity: 0 }]).success).toBe(false)
    expect(
      parsed([{ kind: 'ITEM', itemId: id(), quantity: LOOT_LIMITS.quantity + 1 }]).success
    ).toBe(false)
    expect(parsed([{ kind: 'ROLL', formula: '1d6' }]).success).toBe(false)
  })
})
