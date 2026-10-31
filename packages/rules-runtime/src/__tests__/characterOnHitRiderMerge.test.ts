import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect, type CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import { collectOnHitRiders, mergeOnHitRiders } from '../character/characterOnHitRiders.js'
import { crusher } from '../testing/crusher.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  oncePerTurnSneakAttack,
  unconditionalSneakAttack
} from '../testing/unconditionalSneakAttack.js'

const SLASHING = testUuid(0xb01)
const PIERCING = testUuid(0xb02)
const OWNER = testUuid(0xb03)
const BLUDGEONING = testUuid(0xb04)
const ATTACK_FEATURE = testUuid(0xb05)

type Damage = { pathCode?: 'ON_HIT' | 'ON_CRIT'; damageTypeId: string }

/** An activated weapon attack of the given trigger, with one fixed 1-point damage outcome per entry. */
function attack(
  triggerCode: 'MELEE_WEAPON_ATTACK' | 'RANGED_WEAPON_ATTACK',
  damage: readonly Damage[]
): CompiledEffectGroup {
  const effect: EffectAuthored = {
    id: testUuid(0xb10),
    order: 1,
    invocation: {
      triggerCode,
      activation: { code: 'ACTION', amount: 1 },
      range: { id: testUuid(0xb11), rangeKind: 'SELF' }
    },
    paths: damage.map((entry, index) => ({
      id: testUuid(0xb20 + index),
      order: index + 1,
      pathCode: entry.pathCode ?? 'ON_HIT',
      groupType: 'SINGLE',
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: testUuid(0xb30 + index),
        resultKind: 'SINGLE',
        outcomes: [
          {
            id: testUuid(0xb40 + index),
            effectKind: 'DAMAGE',
            damageTypeId: entry.damageTypeId,
            valueKind: 'FIXED',
            scalingKind: 'NONE',
            amount: 1
          }
        ]
      }
    }))
  }
  return compileEffect(effect)
}

function riderOf(triggerCode: 'MELEE_WEAPON_ATTACK' | 'RANGED_WEAPON_ATTACK') {
  const [effect] = unconditionalSneakAttack(testUuid(0xb50)).effects ?? []
  if (!effect) throw new Error('The rider Feature has no effect.')
  return compileEffect({
    ...effect,
    invocation: { ...effect.invocation, triggerCode }
  })
}

function damageEntries(effect: CompiledEffectGroup) {
  return effect.entries.flatMap((entry) =>
    'outcome' in entry && entry.outcome.effectKind === 'DAMAGE'
      ? [
          {
            pathCode: entry.pathCode,
            pathOrder: entry.pathOrder,
            entryOrder: entry.entryOrder,
            pathGroupId: entry.pathGroupId,
            damageTypeId: entry.outcome.damageTypeId,
            usesTriggeringWeaponDamageType: entry.outcome.usesTriggeringWeaponDamageType
          }
        ]
      : []
  )
}

describe('collecting and merging ON_HIT riders (D119)', () => {
  it('collects only passive Effects’ ON_HIT damage', () => {
    expect(collectOnHitRiders(undefined, OWNER, 'Rider')).toEqual([])
    expect(
      collectOnHitRiders(
        [attack('MELEE_WEAPON_ATTACK', [{ damageTypeId: SLASHING }])],
        OWNER,
        'Rider'
      )
    ).toEqual([])
    const [rider] = collectOnHitRiders([riderOf('MELEE_WEAPON_ATTACK')], OWNER, 'Rider')
    expect(rider).toMatchObject({ triggerCode: 'MELEE_WEAPON_ATTACK' })
    // The rider's three dice rows (Rogue levels 1, 3, 5) are three entries.
    expect(rider?.entries).toHaveLength(3)
  })

  it('appends the rider to the attack’s own ON_HIT damage, of the weapon’s damage type', () => {
    const weapon = attack('MELEE_WEAPON_ATTACK', [{ damageTypeId: SLASHING }])
    const merged = mergeOnHitRiders(
      weapon,
      collectOnHitRiders([riderOf('MELEE_WEAPON_ATTACK')], OWNER, 'Rider'),
      ATTACK_FEATURE
    )
    const [own, ...ridden] = damageEntries(merged)
    expect(ridden).toHaveLength(3)
    for (const entry of ridden) {
      expect(entry).toMatchObject({
        pathCode: 'ON_HIT',
        pathOrder: own?.pathOrder,
        pathGroupId: own?.pathGroupId,
        damageTypeId: SLASHING
      })
      expect(entry.usesTriggeringWeaponDamageType).toBeUndefined()
      expect(entry.entryOrder).toBeGreaterThan(own?.entryOrder ?? Infinity)
    }
  })

  it('applies a rider once when its Feature is acquired twice', () => {
    const weapon = attack('MELEE_WEAPON_ATTACK', [{ damageTypeId: SLASHING }])
    const rider = riderOf('MELEE_WEAPON_ATTACK')
    const merged = mergeOnHitRiders(
      weapon,
      collectOnHitRiders([rider, rider], OWNER, 'Rider'),
      ATTACK_FEATURE
    )
    expect(damageEntries(merged)).toHaveLength(1 + 3)
  })

  it('takes the type of the weapon’s first ON_HIT damage when it deals several', () => {
    const weapon = attack('MELEE_WEAPON_ATTACK', [
      { damageTypeId: PIERCING },
      { damageTypeId: SLASHING }
    ])
    const merged = mergeOnHitRiders(
      weapon,
      collectOnHitRiders([riderOf('MELEE_WEAPON_ATTACK')], OWNER, 'Rider'),
      ATTACK_FEATURE
    )
    expect(damageEntries(merged).at(-1)).toMatchObject({ damageTypeId: PIERCING })
  })

  it('merges a Feature-scoped rider only into that Feature’s attack, in its result block (D164)', () => {
    const [effect] = unconditionalSneakAttack(testUuid(0xb50)).effects ?? []
    if (
      effect?.invocation.kind !== 'PASSIVE' ||
      effect.invocation.triggerCode !== 'MELEE_WEAPON_ATTACK'
    )
      throw new Error('Expected a passive melee rider.')
    const scoped = collectOnHitRiders(
      [
        compileEffect({
          ...effect,
          invocation: { ...effect.invocation, ridesFeatureId: ATTACK_FEATURE }
        })
      ],
      OWNER,
      'Rider'
    )
    const weapon = attack('MELEE_WEAPON_ATTACK', [{ damageTypeId: SLASHING }])
    expect(damageEntries(mergeOnHitRiders(weapon, scoped, testUuid(0xb06)))).toHaveLength(1)

    const merged = mergeOnHitRiders(weapon, scoped, ATTACK_FEATURE)
    const [own, ...ridden] = merged.entries
    if (!own || !('outcome' in own)) throw new Error('Expected the weapon’s damage first.')
    expect(ridden).toHaveLength(3)
    for (const entry of merged.entries)
      expect(entry).toMatchObject({ resultBlockId: own.resultBlockId, groupKind: 'SEQUENTIAL' })
  })
  it('rides a Spell-scoped rider only on a cast of a Spell it names (G4)', () => {
    const [effect] = unconditionalSneakAttack(testUuid(0xb51)).effects ?? []
    if (
      effect?.invocation.kind !== 'PASSIVE' ||
      effect.invocation.triggerCode !== 'MELEE_WEAPON_ATTACK'
    )
      throw new Error('Expected a passive melee rider.')
    const SPELL = testUuid(0xb61)
    const [rider] = collectOnHitRiders(
      [compileEffect({ ...effect, invocation: { ...effect.invocation, ridesSpellIds: [SPELL] } })],
      OWNER,
      'Rider'
    )
    expect(rider?.ridesSpellIds).toEqual([SPELL])
    const weapon = attack('MELEE_WEAPON_ATTACK', [{ damageTypeId: SLASHING }])
    // A Feature's attack is no cast, and a cast of another Spell is not this one.
    expect(damageEntries(mergeOnHitRiders(weapon, [rider!], ATTACK_FEATURE))).toHaveLength(1)
    expect(
      damageEntries(mergeOnHitRiders(weapon, [rider!], undefined, testUuid(0xb62)))
    ).toHaveLength(1)
    expect(damageEntries(mergeOnHitRiders(weapon, [rider!], undefined, SPELL))).toHaveLength(4)
  })

  it('names a rider whose owner is unlabeled, so the player can still tell it from another', () => {
    const [effect] = unconditionalSneakAttack(testUuid(0xb53)).effects ?? []
    if (!effect) throw new Error('Expected a rider effect.')
    const [rider] = collectOnHitRiders([compileEffect(effect)], OWNER, '  ')
    expect(rider?.label.trim()).not.toBe('')
  })

  it('never rides a spell cast with a Feature-scoped rider', () => {
    const [effect] = unconditionalSneakAttack(testUuid(0xb52)).effects ?? []
    if (
      effect?.invocation.kind !== 'PASSIVE' ||
      effect.invocation.triggerCode !== 'MELEE_WEAPON_ATTACK'
    )
      throw new Error('Expected a passive melee rider.')
    const [rider] = collectOnHitRiders(
      [
        compileEffect({
          ...effect,
          invocation: { ...effect.invocation, ridesFeatureId: ATTACK_FEATURE }
        })
      ],
      OWNER,
      'Rider'
    )
    const weapon = attack('MELEE_WEAPON_ATTACK', [{ damageTypeId: SLASHING }])
    expect(
      damageEntries(mergeOnHitRiders(weapon, [rider!], undefined, testUuid(0xb62)))
    ).toHaveLength(1)
  })

  it('leaves an attack alone when no rider names its trigger', () => {
    const weapon = attack('RANGED_WEAPON_ATTACK', [{ damageTypeId: PIERCING }])
    expect(
      mergeOnHitRiders(
        weapon,
        collectOnHitRiders([riderOf('MELEE_WEAPON_ATTACK')], OWNER, 'Rider'),
        ATTACK_FEATURE
      )
    ).toBe(weapon)
  })

  it('leaves an attack with no ON_HIT damage alone', () => {
    const weapon = attack('MELEE_WEAPON_ATTACK', [{ pathCode: 'ON_CRIT', damageTypeId: SLASHING }])
    expect(
      mergeOnHitRiders(
        weapon,
        collectOnHitRiders([riderOf('MELEE_WEAPON_ATTACK')], OWNER, 'Rider'),
        ATTACK_FEATURE
      )
    ).toBe(weapon)
  })

  it('does not merge into a passive Effect', () => {
    const passive = riderOf('MELEE_WEAPON_ATTACK')
    expect(
      mergeOnHitRiders(passive, collectOnHitRiders([passive], OWNER, 'Rider'), ATTACK_FEATURE)
    ).toBe(passive)
  })

  it('makes a limited rider spend its owner’s use, shared by every Effect of that owner', () => {
    const [effect] = oncePerTurnSneakAttack(testUuid(0xb50)).effects ?? []
    if (!effect) throw new Error('The rider Feature has no effect.')
    const melee = compileEffect(effect)
    const ranged = compileEffect({
      ...effect,
      id: testUuid(0xb60),
      invocation: { ...effect.invocation, triggerCode: 'RANGED_WEAPON_ATTACK' }
    })
    const keys = collectOnHitRiders([melee, ranged], OWNER, 'Rider').flatMap((rider) =>
      rider.entries.map((entry) => entry.usageKey)
    )
    expect(keys).toHaveLength(6)
    expect(new Set(keys)).toEqual(new Set([OWNER]))
    const [unlimited] = collectOnHitRiders([riderOf('MELEE_WEAPON_ATTACK')], OWNER, 'Rider')
    expect(unlimited?.entries.every((entry) => entry.usageKey === undefined)).toBe(true)
  })

  it('rides every ON_HIT outcome of a passive Effect, not only its damage (the Crusher’s move)', () => {
    const [effect] = crusher(BLUDGEONING).effects ?? []
    if (!effect) throw new Error('The rider Feature has no effect.')
    const [rider] = collectOnHitRiders([compileEffect(effect)], OWNER, 'Rider')
    expect(rider?.entries.map((entry) => entry.outcome.effectKind)).toEqual(['FORCED_MOVEMENT'])
    const weapon = attack('MELEE_WEAPON_ATTACK', [{ damageTypeId: BLUDGEONING }])
    const merged = mergeOnHitRiders(weapon, rider ? [rider] : [], ATTACK_FEATURE)
    const [own] = damageEntries(merged)
    expect(merged.entries).toHaveLength(2)
    expect(merged.entries.at(-1)).toMatchObject({
      pathCode: 'ON_HIT',
      pathGroupId: own?.pathGroupId,
      usageKey: OWNER,
      outcome: { effectKind: 'FORCED_MOVEMENT', direction: 'ANY', amount: 5 }
    })
  })
})
