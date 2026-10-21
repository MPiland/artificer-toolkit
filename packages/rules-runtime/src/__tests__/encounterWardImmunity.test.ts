import { describe, expect, it } from 'vitest'

import { passedWardImmunityPlan } from '../encounterWardImmunity.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

const WARD_ID = testUuid(0xe101)
const UNKNOWN_SYSTEM_ID = '00000000-0000-4000-8000-0000000000ff'
const wardWith = (duration: { durationKind: 'HOUR'; amount: number }) => ({
  wardId: WARD_ID,
  payload: { successImmunity: { duration: { id: testUuid(0xe102), ...duration } } }
})

describe('passed ward immunity', () => {
  it('plans no immunity when no ward was passed or it carries none', () => {
    expect(passedWardImmunityPlan({ gameSystemId: DND5E_SYSTEM_ID, ward: null })).toBeNull()
    expect(
      passedWardImmunityPlan({
        gameSystemId: DND5E_SYSTEM_ID,
        ward: { wardId: WARD_ID, payload: {} }
      })
    ).toBeNull()
  })

  it('leaves the ward success immunity on its holder for the duration in turns, keyed by the ward', () => {
    const plan = passedWardImmunityPlan({
      gameSystemId: DND5E_SYSTEM_ID,
      ward: wardWith({ durationKind: 'HOUR', amount: 24 })
    })
    expect(plan?.authoredEffectId).toBe(WARD_ID)
    expect(plan?.immunity).toMatchObject({
      compiledEntryId: WARD_ID,
      appliesTo: 'SAVE_SUCCESS',
      immuneToId: WARD_ID,
      initialRemaining: 24 * 600
    })
    expect(plan?.immunity.frozenGraph.id).toBe(WARD_ID)
  })

  it('fails closed on a duration the System cannot count', () => {
    expect(() =>
      passedWardImmunityPlan({
        gameSystemId: DND5E_SYSTEM_ID,
        ward: wardWith({ durationKind: 'HOUR', amount: 0 })
      })
    ).toThrow('The ward success immunity has no countable duration.')
  })

  it('fails closed on a System that does not install rule actions', () => {
    expect(() =>
      passedWardImmunityPlan({
        gameSystemId: UNKNOWN_SYSTEM_ID,
        ward: wardWith({ durationKind: 'HOUR', amount: 24 })
      })
    ).toThrow('The Game System does not provide character-rule-action policy.')
  })
})
