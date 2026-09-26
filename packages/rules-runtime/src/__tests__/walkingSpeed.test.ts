import { describe, expect, it } from 'vitest'

import { resolveWalkingSpeedFeet } from '../walkingSpeed.js'

const walk = { id: '00000000-0000-4000-8000-000000000001', code: 'WALK' }
const fly = { id: '00000000-0000-4000-8000-000000000002', code: 'FLY' }

describe('resolveWalkingSpeedFeet', () => {
  it('reads the walking speed through the System speed vocabulary', () => {
    expect(
      resolveWalkingSpeedFeet(
        [
          { speedId: fly.id, amount: 60, unit: 'FEET' },
          { speedId: walk.id, amount: 30, unit: 'FEET' }
        ],
        [walk, fly]
      )
    ).toBe(30)
    expect(resolveWalkingSpeedFeet([{ speedId: walk.id, amount: 10, unit: 'YARDS' }], [walk])).toBe(
      30
    )
  })

  it('has no walking speed without a walking entry', () => {
    expect(
      resolveWalkingSpeedFeet([{ speedId: fly.id, amount: 60, unit: 'FEET' }], [walk, fly])
    ).toBe(0)
    expect(resolveWalkingSpeedFeet(['not a speed'], [walk])).toBe(0)
  })
})
