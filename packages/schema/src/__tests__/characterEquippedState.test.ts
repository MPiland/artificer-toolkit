import { describe, expect, it } from 'vitest'

import { characterStateDtoSchema, NO_DEATH_SAVES } from '../subjects/characterState.js'

const parseEquipped = (equipped: unknown) =>
  characterStateDtoSchema.safeParse({
    equipment: {
      inventory: [
        { id: 'sword', equipmentId: 'longsword', quantity: 1 },
        { id: 'axe', equipmentId: 'handaxe', quantity: 1 },
        { id: 'shield', equipmentId: 'shield', quantity: 1 }
      ],
      equipped,
      attuned: []
    },
    currency: [],
    hitpoints: { current: 6, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES }
  })

describe('Character equipped state (D107)', () => {
  it('accepts one item per hand and any number of worn items', () => {
    expect(
      parseEquipped([
        { itemId: 'sword', slot: 'MAIN_HAND' },
        { itemId: 'shield', slot: 'OFF_HAND' },
        { itemId: 'axe', slot: 'WORN' }
      ]).success
    ).toBe(true)
  })

  it('refuses an item equipped twice', () => {
    const result = parseEquipped([
      { itemId: 'sword', slot: 'MAIN_HAND' },
      { itemId: 'sword', slot: 'OFF_HAND' }
    ])
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('An item can be equipped only once.')
  })

  it('refuses two items in one hand', () => {
    const result = parseEquipped([
      { itemId: 'sword', slot: 'MAIN_HAND' },
      { itemId: 'axe', slot: 'MAIN_HAND' }
    ])
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('A hand can hold only one item.')
  })

  it('refuses a bare id and a slot it does not know', () => {
    expect(parseEquipped(['sword']).success).toBe(false)
    expect(parseEquipped([{ itemId: 'sword', slot: 'BACK' }]).success).toBe(false)
  })
})
