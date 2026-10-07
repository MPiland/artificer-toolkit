import { describe, expect, it } from 'vitest'
import { RulesRevisionChangedError } from './nativeRulesRevisions.js'
import { MAX_PREPARATION_RETRIES, retryPreparation } from './roomPreparationRetry.js'
import { RoomTestDice } from './roomTestDice.js'

/** A preparation that rolls a d20 then a d6 and stops with a revision change while `changes` remain. */
function roller(changes: { remaining: number }) {
  return async (random: (maximum: number) => number) => {
    const outcome = [random(20), random(6)]
    if (changes.remaining > 0) {
      changes.remaining -= 1
      throw new RulesRevisionChangedError('Live rules revision changed during preparation.')
    }
    return outcome
  }
}

function queuedDice(rolls: number[]) {
  const dice = new RoomTestDice()
  dice.replace({ rolls })
  return (maximum: number) => dice.next(maximum) ?? maximum
}

describe('retryPreparation', () => {
  it('prepares again after refreshing once, and the retry sees the first attempt draws', async () => {
    let refreshes = 0
    const outcome = await retryPreparation(
      queuedDice([7, 3, 11, 5]),
      async () => {
        refreshes += 1
      },
      roller({ remaining: 1 })
    )
    expect(refreshes).toBe(1)
    expect(outcome).toEqual([7, 3])
  })

  it('draws no extra dice across retries and matches an undisturbed command', async () => {
    const undisturbedSource = queuedDice([7, 3, 11, 5])
    const undisturbed = await retryPreparation(
      undisturbedSource,
      async () => undefined,
      roller({ remaining: 0 })
    )
    // The same queue is left for the next command only when the retries drew nothing extra.
    const disturbedSource = queuedDice([7, 3, 11, 5])
    const disturbed = await retryPreparation(
      disturbedSource,
      async () => undefined,
      roller({ remaining: MAX_PREPARATION_RETRIES })
    )
    expect(disturbed).toEqual(undisturbed)
    expect([disturbedSource(20), disturbedSource(6)]).toEqual([
      undisturbedSource(20),
      undisturbedSource(6)
    ])
    expect([disturbedSource(20), disturbedSource(6)]).toEqual([20, 6])
  })

  it('draws only the dice a changed preparation newly needs, from where the draws diverge', async () => {
    const source = queuedDice([7, 3, 4, 5])
    let attempt = 0
    const outcome = await retryPreparation(
      source,
      async () => undefined,
      async (random) => {
        attempt += 1
        const first = random(20)
        if (attempt === 1) throw new RulesRevisionChangedError('changed')
        return [first, random(8), random(6)]
      }
    )
    // d20 reused (7); the d8 was never rolled before, so it takes the next queued roll.
    expect(outcome).toEqual([7, 3, 4])
  })

  it('rethrows the typed error once the bound is spent, without refreshing again', async () => {
    let refreshes = 0
    const rolls = [7, 3, 11, 5]
    const source = queuedDice(rolls)
    await expect(
      retryPreparation(
        source,
        async () => {
          refreshes += 1
        },
        roller({ remaining: MAX_PREPARATION_RETRIES + 1 })
      )
    ).rejects.toBeInstanceOf(RulesRevisionChangedError)
    expect(refreshes).toBe(MAX_PREPARATION_RETRIES)
    expect([source(20), source(6)]).toEqual([11, 5])
  })

  it('does not retry any other failure', async () => {
    let refreshes = 0
    await expect(
      retryPreparation(
        () => 1,
        async () => {
          refreshes += 1
        },
        async () => {
          throw new Error('Some other failure.')
        }
      )
    ).rejects.toThrow('Some other failure.')
    expect(refreshes).toBe(0)
  })
})
