import { describe, expect, it } from 'vitest'

import { resolveIncomingDamage } from '../shared/ruleExecutionMechanics.js'

/** SPELLS-31.T5a: the target's own halving, then immunity, resistance and vulnerability. */
describe('resolveIncomingDamage', () => {
  it.each([
    ['NORMAL', false, 9],
    ['NORMAL', true, 4],
    ['RESISTANT', false, 4],
    ['RESISTANT', true, 2],
    ['VULNERABLE', false, 18],
    ['VULNERABLE', true, 8],
    ['RESISTANT_AND_VULNERABLE', false, 8],
    ['RESISTANT_AND_VULNERABLE', true, 4],
    ['IMMUNE', false, 0],
    ['IMMUNE', true, 0]
  ] as const)('deals 9 %s damage, halved %s, as %i', (damageDisposition, incomingHalved, dealt) => {
    expect(resolveIncomingDamage({ requestedAmount: 9, incomingHalved, damageDisposition })).toBe(
      dealt
    )
  })

  it('rounds each halving down, so halving 1 deals nothing', () => {
    expect(
      resolveIncomingDamage({
        requestedAmount: 1,
        incomingHalved: true,
        damageDisposition: 'NORMAL'
      })
    ).toBe(0)
  })
})
