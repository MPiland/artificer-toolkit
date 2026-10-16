import { describe, expect, it } from 'vitest'

import { attackHitDamageTypeIds } from '../encounterAttackReactionDiscovery.js'

/**
 * REACTION-4.2: a reaction to a damage type is offered only when the hit deals that type, and an
 * ON_CRIT type is dealt only by a critical hit.
 */

const FIRE = 'fire-type'
const RADIANT = 'radiant-type'

const facts = {
  outcomes: [
    { kind: 'DAMAGE', pathCode: 'ON_HIT', damageTypeId: FIRE },
    { kind: 'DAMAGE', pathCode: 'ON_CRIT', damageTypeId: RADIANT },
    { kind: 'DAMAGE', pathCode: 'ON_MISS', damageTypeId: 'miss-type' },
    { kind: 'CONDITION', pathCode: 'ON_HIT', conditionId: 'condition' }
  ]
} as unknown as Parameters<typeof attackHitDamageTypeIds>[0]

describe('damage types an attack deals when it hits', () => {
  it('leaves out an ON_CRIT type on a normal hit', () => {
    expect([...attackHitDamageTypeIds(facts, false)]).toEqual([FIRE])
  })

  it('adds the ON_CRIT types on a critical hit', () => {
    expect([...attackHitDamageTypeIds(facts, true)]).toEqual([FIRE, RADIANT])
  })
})
