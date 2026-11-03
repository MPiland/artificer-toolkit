import { describe, expect, it } from 'vitest'
import { requireFailedCounterReceipt } from '../failedCounterSpend.js'

/** A reactor's reaction as its receipt recorded it: the Character version its spend was planned at. */
const reaction = (spends: boolean, characterStreamVersion: number | null) => ({
  spends,
  failed: { receipt: { characterStreamVersion } }
})

describe('requireFailedCounterReceipt', () => {
  it("accepts a spending reaction whose receipt names the Character's version after its mechanics", () => {
    expect(() =>
      requireFailedCounterReceipt(reaction(true, 7), { characterStreamVersion: 7 })
    ).not.toThrow()
  })

  it('refuses a spending reaction whose receipt names another Character version', () => {
    expect(() =>
      requireFailedCounterReceipt(reaction(true, 6), { characterStreamVersion: 7 })
    ).toThrow('Live Session failed counter Character receipt mismatch.')
    expect(() => requireFailedCounterReceipt(reaction(true, 7), null)).toThrow(
      'Live Session failed counter Character receipt mismatch.'
    )
  })

  it("accepts a free reaction with no recorded version, though its holder's mechanics advanced", () => {
    expect(() =>
      requireFailedCounterReceipt(reaction(false, null), { characterStreamVersion: 7 })
    ).not.toThrow()
    expect(() => requireFailedCounterReceipt(reaction(false, null), null)).not.toThrow()
  })

  it('refuses a free reaction whose receipt records a Character version', () => {
    expect(() =>
      requireFailedCounterReceipt(reaction(false, 7), { characterStreamVersion: 7 })
    ).toThrow('Live Session failed counter Character receipt mismatch.')
  })
})
