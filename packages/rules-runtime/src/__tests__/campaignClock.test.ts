import { describe, expect, it } from 'vitest'

import { campaignMinutesForRounds } from '../campaignClock.js'

describe('campaignMinutesForRounds (SPELLS-5.13, D151)', () => {
  it.each([
    [0, 0],
    [1, 1],
    [10, 1],
    [11, 2],
    [12, 2],
    [100, 10]
  ])('%i rounds take %i Campaign minutes, a started minute counting in full', (rounds, minutes) => {
    expect(campaignMinutesForRounds(rounds)).toBe(minutes)
  })
})
