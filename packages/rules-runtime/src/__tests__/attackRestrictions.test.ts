import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import {
  attackRestrictionsMet,
  reduceEffectRestrictions
} from '../systems/dnd5e/attackRestrictions.js'
import type { Dnd5eAttackingItem } from '../systems/dnd5e/modifierApplicability.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { riderGate } from '../testing/unconditionalSneakAttack.js'

const ADVANTAGE = { predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'ADVANTAGE' } as const
const NOT_DISADVANTAGE = { predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'NOT_DISADVANTAGE' } as const
const FINESSE = { predicateCode: 'EQUIPMENT_PROPERTY', properties: ['FINESSE'] } as const

const rapier: Dnd5eAttackingItem = {
  equipmentIds: [],
  category: 'WEAPON',
  properties: ['FINESSE'],
  grip: 'ONE_HANDED',
  otherWeaponEquipped: false
}
const longsword: Dnd5eAttackingItem = { ...rapier, properties: [] }

function restrictedEffect(gate: ReturnType<typeof riderGate> | undefined) {
  const effect: EffectAuthored = {
    id: testUuid(0xd01),
    order: 1,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: 'MELEE_WEAPON_ATTACK',
      range: { id: testUuid(0xd02), rangeKind: 'SPECIAL' }
    },
    paths: [
      {
        id: testUuid(0xd03),
        order: 1,
        pathCode: 'ON_HIT',
        groupType: 'SINGLE',
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        ...(gate ? { restrictions: gate } : {}),
        resultBlock: {
          id: testUuid(0xd04),
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: testUuid(0xd05),
              effectKind: 'DAMAGE',
              usesTriggeringWeaponDamageType: true,
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 1
            }
          ]
        }
      }
    ]
  }
  return compileEffect(effect)
}

function restrictionsOf(effect: ReturnType<typeof restrictedEffect>) {
  return effect.entries.map((entry) => ('restrictions' in entry ? entry.restrictions : undefined))
}

describe('path restrictions on a compiled attack Effect', () => {
  it('compiles a path’s restrictions onto each of its entries', () => {
    const gate = riderGate([ADVANTAGE])
    expect(restrictionsOf(restrictedEffect(gate))).toEqual([gate])
  })

  it('leaves an unrestricted Effect untouched', () => {
    const effect = restrictedEffect(undefined)
    expect(reduceEffectRestrictions(effect, rapier)).toBe(effect)
  })

  it('keeps only the roll-mode checks of a group whose weapon checks hold', () => {
    const [reduced] = restrictionsOf(
      reduceEffectRestrictions(restrictedEffect(riderGate([FINESSE, ADVANTAGE])), rapier)
    )
    expect(reduced?.groups).toHaveLength(1)
    const conditions = reduced?.groups.flatMap((group) =>
      group.contexts.flatMap((context) => context.conditions ?? [])
    )
    expect(conditions).toMatchObject([{ predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'ADVANTAGE' }])
  })

  it('removes an entry whose weapon checks can never hold', () => {
    const effect = reduceEffectRestrictions(
      restrictedEffect(riderGate([FINESSE, ADVANTAGE])),
      longsword
    )
    expect(effect.entries).toEqual([])
  })

  it('lifts the restriction when a group has only weapon checks and they hold', () => {
    const effect = reduceEffectRestrictions(
      restrictedEffect(riderGate([ADVANTAGE], [FINESSE])),
      rapier
    )
    expect(restrictionsOf(effect)).toEqual([undefined])
  })

  it('drops a group whose weapon checks fail, keeping the others', () => {
    const [reduced] = restrictionsOf(
      reduceEffectRestrictions(restrictedEffect(riderGate([ADVANTAGE], [FINESSE])), longsword)
    )
    expect(reduced?.groups).toHaveLength(1)
  })

  it('honors an excluded weapon check', () => {
    const gate = riderGate([{ ...FINESSE, constraint: 'EXCLUDE' }, ADVANTAGE])
    expect(reduceEffectRestrictions(restrictedEffect(gate), rapier).entries).toEqual([])
    expect(reduceEffectRestrictions(restrictedEffect(gate), longsword).entries).toHaveLength(1)
  })

  it('evaluates a group of roll-mode checks without a weapon (an unarmed or natural attack)', () => {
    const effect = reduceEffectRestrictions(restrictedEffect(riderGate([ADVANTAGE])), null)
    expect(effect.entries).toHaveLength(1)
  })
})

describe('roll-mode checks of reduced restrictions', () => {
  const reducedOf = (...groups: Parameters<typeof riderGate>) => {
    const [restrictions] = restrictionsOf(
      reduceEffectRestrictions(restrictedEffect(riderGate(...groups)), rapier)
    )
    if (!restrictions) throw new Error('Expected remaining roll-mode checks.')
    return restrictions
  }

  it.each([
    ['ADVANTAGE', true],
    ['NORMAL', false],
    ['DISADVANTAGE', false]
  ] as const)('requires advantage: %s -> %s', (rollMode, expected) => {
    expect(attackRestrictionsMet(reducedOf([ADVANTAGE]), rollMode)).toBe(expected)
  })

  it.each([
    ['ADVANTAGE', true],
    ['NORMAL', true],
    ['DISADVANTAGE', false]
  ] as const)('requires no disadvantage: %s -> %s', (rollMode, expected) => {
    expect(attackRestrictionsMet(reducedOf([NOT_DISADVANTAGE]), rollMode)).toBe(expected)
  })

  it('inverts an excluded check', () => {
    const restrictions = reducedOf([{ ...ADVANTAGE, constraint: 'EXCLUDE' }])
    expect(attackRestrictionsMet(restrictions, 'ADVANTAGE')).toBe(false)
    expect(attackRestrictionsMet(restrictions, 'NORMAL')).toBe(true)
  })

  it('holds when any group holds, each with all of its checks', () => {
    const restrictions = reducedOf([ADVANTAGE, NOT_DISADVANTAGE], [NOT_DISADVANTAGE])
    expect(attackRestrictionsMet(restrictions, 'DISADVANTAGE')).toBe(false)
    expect(attackRestrictionsMet(restrictions, 'NORMAL')).toBe(true)
  })

  it('refuses restrictions that still hold weapon checks', () => {
    expect(() => attackRestrictionsMet(riderGate([FINESSE]), 'NORMAL')).toThrow(
      'Attack restrictions must be reduced to roll-mode checks.'
    )
  })
})
