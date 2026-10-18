import { describe, expect, it } from 'vitest'

import { characterStateDtoSchema, NO_DEATH_SAVES } from '../subjects/characterState.js'

const parseHitpoints = (hitpoints: Record<string, unknown>) =>
  characterStateDtoSchema.safeParse({
    equipment: { inventory: [], equipped: [], attuned: [] },
    currency: [],
    hitpoints: { current: 6, hitDice: [], deathSaves: NO_DEATH_SAVES, ...hitpoints }
  })

describe('Character hit points state', () => {
  it('records temporary hit points as 0 when the Character has none', () => {
    expect(parseHitpoints({ temp: 0 }).data?.hitpoints.temp).toBe(0)
  })

  it('refuses hit points without temporary hit points', () => {
    expect(parseHitpoints({}).success).toBe(false)
  })
})
