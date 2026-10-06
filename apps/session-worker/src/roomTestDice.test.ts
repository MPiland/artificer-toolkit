import { expect, it } from 'vitest'
import { RoomTestDice } from './roomTestDice.js'

it('hands out queued rolls in order as they are, then the repeat value, then defers to the platform', () => {
  const dice = new RoomTestDice()
  expect(dice.next()).toBeNull()
  dice.replace({ rolls: [19, 0, 7], repeat: 3 })
  expect([dice.next(), dice.next(), dice.next(), dice.next(), dice.next()]).toEqual([
    19, 0, 7, 3, 3
  ])
  dice.replace({ rolls: [4] })
  expect([dice.next(), dice.next()]).toEqual([4, null])
})

it('replaces the earlier queue and repeat value, so an empty request clears them', () => {
  const dice = new RoomTestDice()
  dice.replace({ rolls: [1, 2], repeat: 5 })
  dice.replace({ rolls: [] })
  expect(dice.next()).toBeNull()
})
