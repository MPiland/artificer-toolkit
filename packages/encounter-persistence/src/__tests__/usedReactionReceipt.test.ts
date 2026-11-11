import { describe, expect, it } from 'vitest'
import { requireUsedReactionReceipt } from '../usedReactionSpend.js'

/** A reactor's reaction as its receipt recorded it: the Character version its spend was planned at. */
const reaction = (spends: boolean, characterStreamVersion: number | null) => ({
  spends,
  used: { receipt: { characterStreamVersion } }
})

describe('requireUsedReactionReceipt', () => {
  it("accepts a spending reaction whose receipt names the Character's version after its mechanics", () => {
    expect(() =>
      requireUsedReactionReceipt(reaction(true, 7), { characterStreamVersion: 7 })
    ).not.toThrow()
  })

  it('refuses a spending reaction whose receipt names another Character version', () => {
    expect(() =>
      requireUsedReactionReceipt(reaction(true, 6), { characterStreamVersion: 7 })
    ).toThrow('Live Session used reaction Character receipt mismatch.')
    expect(() => requireUsedReactionReceipt(reaction(true, 7), null)).toThrow(
      'Live Session used reaction Character receipt mismatch.'
    )
  })

  it("accepts a free reaction with no recorded version, though its holder's mechanics advanced", () => {
    expect(() =>
      requireUsedReactionReceipt(reaction(false, null), { characterStreamVersion: 7 })
    ).not.toThrow()
    expect(() => requireUsedReactionReceipt(reaction(false, null), null)).not.toThrow()
  })

  it('refuses a free reaction whose receipt records a Character version', () => {
    expect(() =>
      requireUsedReactionReceipt(reaction(false, 7), { characterStreamVersion: 7 })
    ).toThrow('Live Session used reaction Character receipt mismatch.')
  })
})
