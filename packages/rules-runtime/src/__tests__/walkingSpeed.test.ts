import { describe, expect, it } from 'vitest'

import { resolveSpeedsFeet } from '../walkingSpeed.js'

const walk = { id: '00000000-0000-4000-8000-000000000001', code: 'WALK' }
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

  it('fails the read on a speed type the System vocabulary does not know', () => {
    expect(() =>
      resolveSpeedsFeet([{ speedId: fly.id, amount: 60, unit: 'FEET' }], [walk])
    ).toThrow(`Speed ${fly.id} is not in the System speed vocabulary.`)
  })

  it('fails the read on a value that is not a speed', () => {
    expect(() =>
      resolveSpeedsFeet([{ speedId: walk.id, amount: 30, unit: 'FEET' }, 'not a speed'], [walk])
    ).toThrow(/object/)
    expect(() =>
      resolveSpeedsFeet([{ speedId: walk.id, amount: 30, unit: 'FURLONGS' }], [walk])
    ).toThrow(/unit/)
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
