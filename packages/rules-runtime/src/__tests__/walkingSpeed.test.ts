import { describe, expect, it } from 'vitest'

import { resolveSpeedsFeet, WALK_SPEED_CODE } from '../walkingSpeed.js'

const walk = { id: '00000000-0000-4000-8000-000000000001', code: WALK_SPEED_CODE }
const fly = { id: '00000000-0000-4000-8000-000000000002', code: 'FLY' }

describe('resolveSpeedsFeet', () => {
  it('reads every typed speed in feet through the System speed vocabulary', () => {
    expect(
      resolveSpeedsFeet(
        [
          { speedId: fly.id, amount: 60, unit: 'FEET' },
          { speedId: walk.id, amount: 10, unit: 'YARDS' }
        ],
        [walk, fly]
      )
    ).toEqual([
      { speedId: fly.id, feet: 60 },
      { speedId: walk.id, feet: 30 }
    ])
  })

  it('has no speed for an unknown speed type or a value that is not a speed', () => {
    expect(
      resolveSpeedsFeet([{ speedId: fly.id, amount: 60, unit: 'FEET' }, 'not a speed'], [walk])
    ).toEqual([])
  })

  it('keeps the first entry of a speed type', () => {
    expect(
      resolveSpeedsFeet(
        [
          { speedId: walk.id, amount: 30, unit: 'FEET' },
          { speedId: walk.id, amount: 45, unit: 'FEET' }
        ],
        [walk]
      )
    ).toEqual([{ speedId: walk.id, feet: 30 }])
  })
})
