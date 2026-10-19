import { bandit } from '@artificer-toolkit/source-data/srd/creatures/bandit.js'
import { erinyes } from '@artificer-toolkit/source-data/srd/creatures/erinyes.js'
import { gladiator } from '@artificer-toolkit/source-data/srd/creatures/gladiator.js'
import { knight } from '@artificer-toolkit/source-data/srd/creatures/knight.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  attackHitDamageTypeIds,
  discoverAttackReactionActions,
  encounterReactorCandidates
} from '../encounterAttackReactionDiscovery.js'
import { srdCreatureActor } from '../testing/dnd5eSrdEncounter.js'

/**
 * SPELLS-33.T4k1: a Creature's authored `ATTACKED_SELF` reaction (Parry) is discovered from its own
 * feature actions, as its turn reads them, and answers only a hit its qualifiers admit: a melee attack
 * by an attacker the reactor sees.
 */

const reactorCandidates = (creature: Parameters<typeof srdCreatureActor>[0]['creature']) =>
  encounterReactorCandidates({
    actor: srdCreatureActor({ id: crypto.randomUUID(), creature }),
    target: {},
    system: srdSystemRecord
  })

const meleeSeenHit = { damageTypeIds: new Set<string>(), melee: true, reactorSeesAttacker: true }

describe('creature attack reaction discovery', () => {
  it.each([knight, gladiator, erinyes])(
    "offers $name's Parry against a melee hit by an attacker it sees",
    (creature) => {
      const found = discoverAttackReactionActions(reactorCandidates(creature), meleeSeenHit)
      expect(found).toEqual([
        expect.objectContaining({ trigger: 'ATTACKED_SELF', triggerDamageTypeIds: [] })
      ])
    }
  )

  it('offers nothing against a ranged hit', () => {
    expect(
      discoverAttackReactionActions(reactorCandidates(knight), { ...meleeSeenHit, melee: false })
    ).toEqual([])
  })

  it('offers nothing against an attacker the reactor does not see', () => {
    expect(
      discoverAttackReactionActions(reactorCandidates(knight), {
        ...meleeSeenHit,
        reactorSeesAttacker: false
      })
    ).toEqual([])
  })

  it('offers nothing to a creature holding no attack reaction', () => {
    expect(discoverAttackReactionActions(reactorCandidates(bandit), meleeSeenHit)).toEqual([])
  })
})

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
