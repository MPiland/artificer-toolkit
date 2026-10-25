import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { describe, expect, it } from 'vitest'

import {
  applyDamageInterceptions,
  type HeldDamageInterception,
  withInterceptionChargesSpent
} from '../encounterDamageInterception.js'
import { planCreatureRest } from '../encounterCreatureRest.js'
import {
  withInterceptionSaveRolls,
  withRecordedInterceptionSaveRolls
} from '../encounterInterceptionSaveRolls.js'
import type { CharacterRuleActionApplication } from '../characterRuleActionSystemAdapter.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { srdCreatureActor, srdCreatureTarget, testUuid } from '../testing/dnd5eSrdEncounter.js'

function srdCreature(label: string): CreatureAuthored {
  const creature = srdBaselineContent.subjects.creatures.find((entry) => entry.label === label)
  if (!creature) throw new Error(`SRD Creature "${label}" is missing.`)
  return creature
}

const interceptionsOf = (creature: CreatureAuthored, featureCharges?: Record<string, number>) =>
  srdCreatureTarget(srdCreatureActor({ id: testUuid(0x5000), creature, featureCharges }))
    .damageInterceptions

const feature = (creature: CreatureAuthored, label: string) => {
  const found = creature.features.find((entry) => entry.label.startsWith(label))
  if (!found) throw new Error(`${creature.label} has no ${label}.`)
  return found
}

const damageApplication: Extract<CharacterRuleActionApplication, { kind: 'DAMAGE' }> = {
  sourceNodeId: 'node',
  sourceOperationKey: 'operation',
  authoredPath: null,
  resolvedPath: null,
  targetActorId: testUuid(0x5001),
  kind: 'DAMAGE',
  requestedAmount: 14,
  resolvedAmount: 14,
  appliedAmount: 10,
  beforeCurrentHitPoints: 10,
  afterCurrentHitPoints: 0,
  beforeTemporaryHitPoints: 0,
  afterTemporaryHitPoints: 0,
  maximumHitPoints: 30,
  damageTypeId: testUuid(0x5010),
  damageDisposition: 'NORMAL',
  incomingHalved: false,
  critical: false
}

const fortitude = {
  dropToHitPoints: 1,
  negatesKill: false,
  save: { ability: 'CONSTITUTION', dc: { base: 5, plusDamageTaken: true } },
  excludes: { critical: true }
}

describe('feature-held damage interceptions on SRD Creatures (SPELLS-33.T4i2b)', () => {
  it.each(['Zombie', 'Ogre Zombie'])(
    "%s's Undead Fortitude is held every time, with no charge to spend",
    (label) => {
      const creature = srdCreature(label)
      expect(interceptionsOf(creature)).toMatchObject([
        { effectId: feature(creature, 'Undead Fortitude').id, ...fortitude }
      ])
      expect(interceptionsOf(creature)[0]).not.toHaveProperty('charge')
    }
  )

  it("holds the Wereboar's Relentless against 14 damage until its charge is spent", () => {
    const wereboar = srdCreature('Wereboar')
    const relentless = feature(wereboar, 'Relentless')
    const [held] = interceptionsOf(wereboar)
    expect(held).toMatchObject({
      effectId: relentless.id,
      dropToHitPoints: 1,
      maxDamageTaken: 14,
      charge: { ownerFeatureId: relentless.id, cost: 1, used: 0, amount: 1 }
    })
    expect(interceptionsOf(wereboar, { [relentless.id]: 1 })).toEqual([])
  })

  it('spends the charge on the intercepted blow, records a receipt and holds no more', () => {
    const wereboar = srdCreature('Wereboar')
    const relentless = feature(wereboar, 'Relentless')
    const actor = srdCreatureActor({ id: testUuid(0x5001), creature: wereboar })
    const held = srdCreatureTarget(actor).damageInterceptions
    const [planned] = applyDamageInterceptions({
      applications: [{ ...damageApplication, targetActorId: actor.id }],
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      interceptions: held
    })
    expect(planned).toMatchObject({
      interceptedBy: relentless.id,
      afterCurrentHitPoints: 1,
      interceptionCharge: {
        ownerFeatureId: relentless.id,
        beforeUsed: 0,
        afterUsed: 1,
        beforeRemaining: 1,
        afterRemaining: 0
      }
    })
    const spent = withInterceptionChargesSpent(actor, planned ? [planned] : [])
    expect(srdCreatureTarget(spent).damageInterceptions).toEqual([])
  })

  it('recovers the Relentless charge on a short rest through the creature rest machinery', () => {
    const wereboar = srdCreature('Wereboar')
    const relentless = feature(wereboar, 'Relentless')
    const actor = srdCreatureActor({
      id: testUuid(0x5002),
      creature: wereboar,
      featureCharges: { [relentless.id]: 1 }
    })
    expect(planCreatureRest(actor, 'SHORT').resets).toEqual([{ key: relentless.id, beforeUsed: 1 }])
  })

  it('rolls the Constitution save once per interception, with the holder modifier', () => {
    const zombie = srdCreature('Zombie')
    const draws = [8]
    const target = withInterceptionSaveRolls({
      gameSystemId: DND5E_SYSTEM_ID,
      target: srdCreatureTarget(srdCreatureActor({ id: testUuid(0x5003), creature: zombie })),
      random: () => draws.shift() ?? 0
    })
    // The d20 is the draw plus one; the Zombie's Constitution 16 adds +3.
    expect(target.damageInterceptions[0]?.saveRoll).toEqual({ rawDie: 9, addedTotal: 3 })
    expect(draws).toEqual([])
  })

  it('fails closed for a Game System with no saving-throw capability', () => {
    const target = srdCreatureTarget(
      srdCreatureActor({ id: testUuid(0x5005), creature: srdCreature('Zombie') })
    )
    expect(() =>
      withInterceptionSaveRolls({ gameSystemId: testUuid(0x5006), target, random: () => 0 })
    ).toThrow()
  })

  it('draws nothing for a target none of whose interceptions ask a save', () => {
    const target = srdCreatureTarget(
      srdCreatureActor({ id: testUuid(0x5004), creature: srdCreature('Wereboar') })
    )
    expect(
      withInterceptionSaveRolls({
        gameSystemId: DND5E_SYSTEM_ID,
        target,
        random: () => {
          throw new Error('No die should be drawn.')
        }
      })
    ).toBe(target)
  })

  it('replays the die the planner recorded for a room commit', () => {
    const zombie = srdCreature('Zombie')
    const [held] = interceptionsOf(zombie)
    if (!held) throw new Error('Expected the Zombie interception.')
    const [replayed] = withRecordedInterceptionSaveRolls(
      [held],
      [
        {
          ...damageApplication,
          interceptionSaves: [
            { effectId: held.effectId, rawDie: 14, addedTotal: 3, dc: 15, passed: true }
          ]
        }
      ]
    )
    expect(replayed?.saveRoll).toEqual({ rawDie: 14, addedTotal: 3 })
  })
})

describe('a homebrew Creature authored from the same core options', () => {
  it('intercepts like the Zombie and recharges like the Wereboar', () => {
    const goblin = srdCreature('Goblin')
    const zombieGrants = feature(srdCreature('Zombie'), 'Undead Fortitude').grants?.modifiers
    const wereboarFeature = feature(srdCreature('Wereboar'), 'Relentless')
    if (!zombieGrants || !wereboarFeature.grants?.modifiers) throw new Error('Grants are missing.')
    const homebrew: CreatureAuthored = {
      ...goblin,
      id: testUuid(0x5100),
      features: [
        ...goblin.features,
        {
          id: testUuid(0x5101),
          label: 'Homebrew Fortitude',
          description: 'Stubborn.',
          order: 98,
          grants: {
            modifiers: zombieGrants.map((grant, order) => ({
              ...grant,
              id: testUuid(0x5200 + order)
            }))
          }
        },
        {
          ...wereboarFeature,
          id: testUuid(0x5102),
          label: 'Homebrew Relentless',
          order: 99,
          charges: { ...wereboarFeature.charges!, id: testUuid(0x5103) },
          grants: {
            modifiers: wereboarFeature.grants.modifiers.map((grant, order) => ({
              ...grant,
              id: testUuid(0x5300 + order)
            }))
          }
        }
      ]
    }
    const held: readonly HeldDamageInterception[] = interceptionsOf(homebrew)
    expect(held).toMatchObject([
      { effectId: testUuid(0x5101), ...fortitude },
      { effectId: testUuid(0x5102), maxDamageTaken: 14, charge: { amount: 1, used: 0 } }
    ])
  })
})
