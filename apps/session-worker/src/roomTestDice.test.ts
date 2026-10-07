import { expect, it } from 'vitest'
import { RoomTestDice } from './roomTestDice.js'

it('hands out queued rolls in order as they are, then the repeat value, then defers to the platform', () => {
  const dice = new RoomTestDice()
  expect(dice.next(20)).toBeNull()
  dice.replace({ rolls: [19, 0, 7], repeat: 3 })
  expect([dice.next(20), dice.next(20), dice.next(20), dice.next(20), dice.next(20)]).toEqual([
    19, 0, 7, 3, 3
  ])
  dice.replace({ rolls: [4] })
  expect([dice.next(20), dice.next(20)]).toEqual([4, null])
})

it('replaces the earlier queue and repeat value, so an empty request clears them', () => {
  const dice = new RoomTestDice()
  dice.replace({ rolls: [1, 2], repeat: 5 })
  dice.replace({ rolls: [] })
  expect(dice.next(20)).toBeNull()
})

it('fails loudly when a queued roll or the repeat value is outside the die range', () => {
  const dice = new RoomTestDice()
  dice.replace({ rolls: [5, 14] })
  expect(dice.next(6)).toBe(5)
  expect(() => dice.next(6)).toThrow('Queued test roll 14 is outside the die range 0 to 5.')
  dice.replace({ rolls: [], repeat: 6 })
  expect(() => dice.next(6)).toThrow('Queued test roll 6 is outside the die range 0 to 5.')
})
