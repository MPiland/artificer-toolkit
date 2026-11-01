import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import { collectOnHitRiders } from '../character/characterOnHitRiders.js'
import {
  effectReadsEnemyProximity,
  oncePerTurnUsageKey
} from '../systems/dnd5e/attackRestrictions.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  prepareCreatureAction,
  settleCreatureAction,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0xc1)
const TARGET_ID = testUuid(0xc2)

/** What an attack-roll advantage source on the target (such as being Restrained) gives attacks against it. */
const advantageAgainst = (attackDomain: 'MELEE' | 'RANGED') => ({
  attackDomain,
  requiresHolderSeesAttacker: false,
  exemptAttackerSenseDefinitionIds: [],
  eventScope: { actorId: null, turnActorId: null },
  sourceQualifier: [],
  contributor: {
    sourceId: 'test:advantage',
    grantId: null,
    domainKey: 'test:advantage',
    influence: 'ADVANTAGE' as const,
    source: { kind: 'AUTHORED' as const, id: 'test:advantage', holderActorId: null }
  },
  suppressedInfluence: null
})

/**
 * A seeded SRD Creature's weapon attack against the seeded Ogre (AC 11), with every roll a 0-based
 * die face in request order. No Scene, so no ally's proximity can be read.
 */
async function attackOgre(input: {
  attacker: string
  feature: string
  rolls: readonly number[]
  advantage?: 'MELEE' | 'RANGED'
  turnUses?: readonly string[]
}) {
  const attacker = srdByLabel(SRD.creatures, input.attacker)
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
    target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    featureId: creatureFeature(attacker, input.feature).id,
    overridable: true,
    ...(input.turnUses ? { turnUses: input.turnUses } : {}),
    ...(input.advantage ? { targetAttacksAgainst: [advantageAgainst(input.advantage)] } : {})
  })
  const { execution } = await settleCreatureAction({ prepared, rolls: input.rolls })
  return execution.applications.flatMap((application) =>
    application.kind === 'DAMAGE'
      ? [[application.requestedAmount, application.damageTypeId] as const]
      : []
  )
}

describe('the SRD Assassin’s and Spy’s Sneak Attack, authored from core options (D156)', () => {
  it.each([
    ['Assassin', 'Sneak Attack'],
    ['Spy', 'Sneak Attack (1/Turn)']
  ])(
    'rides the %s’s melee and ranged weapon attacks once per turn, keyed by its Feature',
    (creature, label) => {
      const feature = creatureFeature(srdByLabel(SRD.creatures, creature), label)
      const effects = (feature.effects ?? []).map((effect) => compileEffect(effect))
      for (const effect of effects) expect(effectReadsEnemyProximity(effect)).toBe(true)
      const riders = collectOnHitRiders(effects, feature.id, feature.label)
      expect(riders.map((rider) => rider.triggerCode)).toEqual([
        'MELEE_WEAPON_ATTACK',
        'RANGED_WEAPON_ATTACK'
      ])
      const keys = riders.flatMap((rider) =>
        rider.entries.map((entry) => oncePerTurnUsageKey(entry, 'unused'))
      )
      expect(new Set(keys)).toEqual(new Set([feature.id]))
    }
  )

  it('adds the Assassin’s 4d6 to an advantaged Shortsword hit as its own hit in the weapon’s damage type', async () => {
    // Shortsword, +6: 1d6 + 3 piercing; Sneak Attack 4d6. Both d20s 15; dice 3, then 1, 1, 1, 1.
    const damage = await attackOgre({
      attacker: 'Assassin',
      feature: 'Shortsword',
      rolls: [14, 14, 2, 0, 0, 0, 0],
      advantage: 'MELEE'
    })
    expect(damage).toEqual([
      [3 + 3, srdDamageTypeId('PIERCING')],
      [4, srdDamageTypeId('PIERCING')]
    ])
  })

  it('adds nothing to an advantaged Shortsword hit once the Assassin has used Sneak Attack this turn', async () => {
    const assassin = srdByLabel(SRD.creatures, 'Assassin')
    const damage = await attackOgre({
      attacker: 'Assassin',
      feature: 'Shortsword',
      rolls: [14, 14, 2],
      advantage: 'MELEE',
      turnUses: [creatureFeature(assassin, 'Sneak Attack').id]
    })
    expect(damage).toEqual([[3 + 3, srdDamageTypeId('PIERCING')]])
  })

  it('adds nothing to a normal Shortsword hit when no ally of the Assassin can be read near the target', async () => {
    const damage = await attackOgre({ attacker: 'Assassin', feature: 'Shortsword', rolls: [14, 2] })
    expect(damage).toEqual([[3 + 3, srdDamageTypeId('PIERCING')]])
  })

  it('folds no rider from the Bugbear’s description-only Surprise Attack', async () => {
    const feature = creatureFeature(srdByLabel(SRD.creatures, 'Bugbear'), 'Surprise Attack')
    expect(
      collectOnHitRiders(
        (feature.effects ?? []).map((effect) => compileEffect(effect)),
        feature.id,
        feature.label
      )
    ).toEqual([])
    // Morningstar, +4: 2d8 + 2 piercing, with no 2d6 surprise damage. d20 15; dice 3 and 1.
    const damage = await attackOgre({
      attacker: 'Bugbear',
      feature: 'Morningstar',
      rolls: [14, 2, 0]
    })
    expect(damage).toEqual([[3 + 1 + 2, srdDamageTypeId('PIERCING')]])
  })

  it('adds the Spy’s 2d6 to an advantaged Hand Crossbow hit', async () => {
    // Hand Crossbow, +4: 1d6 + 2 piercing; Sneak Attack 2d6. Both d20s 15; dice 3, then 1, 1.
    const damage = await attackOgre({
      attacker: 'Spy',
      feature: 'Hand Crossbow',
      rolls: [14, 14, 2, 0, 0],
      advantage: 'RANGED'
    })
    expect(damage).toEqual([
      [3 + 2, srdDamageTypeId('PIERCING')],
      [2, srdDamageTypeId('PIERCING')]
    ])
  })
})
