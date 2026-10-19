import { describe, expect, it } from 'vitest'

import {
  temporaryHitPointsAfterEffectsEnd,
  temporaryHitPointsAfterGrant,
  temporaryHitPointsAfterLoss,
  temporaryHitPointsAfterRelease,
  temporaryHitPointsSet,
  withActorTemporaryHitPoints,
  withCharacterTemporaryHitPoints
} from '../shared/temporaryHitPoints.js'

const FIRST = 'effect-first'
const SECOND = 'effect-second'

describe('effect-owned temporary hit points (D156)', () => {
  it('keeps the source while damage leaves any of the pool, and drops it with the last point', () => {
    const pool = { amount: 7, sourceEffectId: FIRST }
    expect(temporaryHitPointsAfterLoss(pool, 3)).toEqual({ amount: 4, sourceEffectId: FIRST })
    expect(temporaryHitPointsAfterLoss(pool, 7)).toEqual({ amount: 0, sourceEffectId: null })
  })

  it('lets a bigger grant from another effect replace the pool, so ending the first effect leaves it', () => {
    const first = temporaryHitPointsAfterGrant(
      { amount: 0, sourceEffectId: null },
      { amount: 3, sourceEffectId: FIRST }
    )
    const replaced = temporaryHitPointsAfterGrant(first, { amount: 8, sourceEffectId: SECOND })
    expect(replaced).toEqual({ amount: 8, sourceEffectId: SECOND })
    expect(temporaryHitPointsAfterRelease(replaced, FIRST)).toEqual(replaced)
    expect(temporaryHitPointsAfterRelease(replaced, SECOND)).toEqual({
      amount: 0,
      sourceEffectId: null
    })
  })

  it('keeps the pool and its source against a grant no bigger than it', () => {
    const pool = { amount: 5, sourceEffectId: FIRST }
    expect(temporaryHitPointsAfterGrant(pool, { amount: 5, sourceEffectId: SECOND })).toEqual(pool)
  })

  it('clears the source on a manual set, so no effect ending takes the amount', () => {
    const set = temporaryHitPointsSet(6)
    expect(set).toEqual({ amount: 6, sourceEffectId: null })
    expect(temporaryHitPointsAfterEffectsEnd(set, [FIRST, SECOND])).toEqual(set)
  })

  it('releases the pool when any of the effects ending together is its source', () => {
    expect(
      temporaryHitPointsAfterEffectsEnd({ amount: 4, sourceEffectId: SECOND }, [FIRST, SECOND])
    ).toEqual({ amount: 0, sourceEffectId: null })
  })

  it('stores the source key on a Run actor and a Character only while an effect holds the pool', () => {
    const actor = withActorTemporaryHitPoints(
      { tempHitPoints: 2, tempHitPointsSourceEffectId: FIRST },
      temporaryHitPointsSet(3)
    )
    expect(actor).toEqual({ tempHitPoints: 3 })
    expect(
      withCharacterTemporaryHitPoints(
        { temp: 0, current: 9 },
        { amount: 4, sourceEffectId: SECOND }
      )
    ).toEqual({ temp: 4, current: 9, tempSourceEffectId: SECOND })
  })
})
