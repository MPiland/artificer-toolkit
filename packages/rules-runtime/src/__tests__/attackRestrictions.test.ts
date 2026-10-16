import type { EffectAuthored, FacetAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import {
  attackRestrictionsMet,
  effectReadsEnemyProximity,
  reduceEffectRestrictions,
  type Dnd5eAttackCircumstances
} from '../systems/dnd5e/attackRestrictions.js'
import type { Dnd5eAttackingItem } from '../systems/dnd5e/modifierApplicability.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { riderGate, type RiderGateCondition } from '../testing/unconditionalSneakAttack.js'

const ADVANTAGE = { predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'ADVANTAGE' } as const
const NOT_DISADVANTAGE = { predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'NOT_DISADVANTAGE' } as const
const ENEMY_WITHIN_5 = { predicateCode: 'ENEMY_NEAR_TARGET', feet: 5 } as const
const FINESSE = { predicateCode: 'EQUIPMENT_PROPERTY', properties: ['FINESSE'] } as const

const circumstances = (
  rollMode: Dnd5eAttackCircumstances['rollMode'],
  enemyProximity: Dnd5eAttackCircumstances['enemyProximity'] = null
): Dnd5eAttackCircumstances => ({ rollMode, enemyProximity })

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
      group.contexts.flatMap((context) => [...(context.conditions ?? [])])
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

  it('treats a facet without groups as unrestricted', () => {
    const effect = reduceEffectRestrictions(restrictedEffect(riderGate()), rapier)
    expect(restrictionsOf(effect)).toEqual([undefined])
  })

  const unanswerable = (subject: 'EQUIPMENT' | 'CHARACTER'): FacetAuthored => ({
    id: testUuid(0xe01),
    groups: [
      {
        id: testUuid(0xe02),
        order: 0,
        contexts: [
          subject === 'EQUIPMENT'
            ? {
                id: testUuid(0xe03),
                order: 0,
                subject,
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    id: testUuid(0xe04),
                    order: 0,
                    kind: 'PREDICATE',
                    constraint: 'EXCLUDE',
                    predicateCode: 'ATTACK_ABILITY',
                    ability: 'DEXTERITY'
                  }
                ]
              }
            : {
                id: testUuid(0xe03),
                order: 0,
                subject,
                conditions: [
                  {
                    id: testUuid(0xe04),
                    order: 0,
                    kind: 'PREDICATE',
                    constraint: 'EXCLUDE',
                    predicateCode: 'CAN_ACT'
                  }
                ]
              }
        ]
      }
    ]
  })

  it.each([
    ['an excluded attack ability the weapon cannot answer', 'EQUIPMENT'],
    ['an excluded Character check', 'CHARACTER']
  ] as const)('fails a group holding %s, whatever its constraint', (_name, subject) => {
    const effect = reduceEffectRestrictions(restrictedEffect(unanswerable(subject)), rapier)
    expect(effect.entries).toEqual([])
  })
})

describe('circumstance checks of reduced restrictions', () => {
  const reducedOf = (...groups: (readonly RiderGateCondition[])[]) => {
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
    expect(attackRestrictionsMet(reducedOf([ADVANTAGE]), circumstances(rollMode))).toBe(expected)
  })

  it.each([
    ['ADVANTAGE', true],
    ['NORMAL', true],
    ['DISADVANTAGE', false]
  ] as const)('requires no disadvantage: %s -> %s', (rollMode, expected) => {
    expect(attackRestrictionsMet(reducedOf([NOT_DISADVANTAGE]), circumstances(rollMode))).toBe(expected)
  })

  it('needs every check of a group, not any', () => {
    const restrictions = reducedOf([ADVANTAGE, NOT_DISADVANTAGE])
    expect(attackRestrictionsMet(restrictions, circumstances('NORMAL'))).toBe(false)
    expect(attackRestrictionsMet(restrictions, circumstances('ADVANTAGE'))).toBe(true)
  })

  it('inverts an excluded check', () => {
    const restrictions = reducedOf([{ ...ADVANTAGE, constraint: 'EXCLUDE' }])
    expect(attackRestrictionsMet(restrictions, circumstances('ADVANTAGE'))).toBe(false)
    expect(attackRestrictionsMet(restrictions, circumstances('NORMAL'))).toBe(true)
  })

  it('holds when any group holds, each with all of its checks', () => {
    const restrictions = reducedOf([ADVANTAGE, NOT_DISADVANTAGE], [NOT_DISADVANTAGE])
    expect(attackRestrictionsMet(restrictions, circumstances('DISADVANTAGE'))).toBe(false)
    expect(attackRestrictionsMet(restrictions, circumstances('NORMAL'))).toBe(true)
  })

  describe('an enemy near the target', () => {
    it.each([
      [0, true],
      [5, true],
      [5.5, false],
      [30, false]
    ])('requires an able enemy within 5 ft: nearest at %s ft -> %s', (nearestFeet, expected) => {
      expect(
        attackRestrictionsMet(
          reducedOf([ENEMY_WITHIN_5]),
          circumstances('NORMAL', { nearestFeet })
        )
      ).toBe(expected)
    })

    it('is not met when no able enemy stands anywhere', () => {
      expect(
        attackRestrictionsMet(
          reducedOf([ENEMY_WITHIN_5]),
          circumstances('NORMAL', { nearestFeet: null })
        )
      ).toBe(false)
    })

    it('has no answer without a Scene, whatever its constraint', () => {
      for (const constraint of ['INCLUDE', 'EXCLUDE'] as const)
        expect(
          attackRestrictionsMet(reducedOf([{ ...ENEMY_WITHIN_5, constraint }]), circumstances('NORMAL'))
        ).toBe(false)
    })

    it('inverts an excluded check once the Scene measured', () => {
      const restrictions = reducedOf([{ ...ENEMY_WITHIN_5, constraint: 'EXCLUDE' }])
      expect(
        attackRestrictionsMet(restrictions, circumstances('NORMAL', { nearestFeet: 5 }))
      ).toBe(false)
      expect(
        attackRestrictionsMet(restrictions, circumstances('NORMAL', { nearestFeet: null }))
      ).toBe(true)
    })

    it('composes with roll mode through OR-ed groups (Sneak Attack’s two ways in)', () => {
      const restrictions = reducedOf([ADVANTAGE], [ENEMY_WITHIN_5, NOT_DISADVANTAGE])
      const near = { nearestFeet: 5 }
      expect(attackRestrictionsMet(restrictions, circumstances('ADVANTAGE'))).toBe(true)
      expect(attackRestrictionsMet(restrictions, circumstances('NORMAL', near))).toBe(true)
      expect(attackRestrictionsMet(restrictions, circumstances('DISADVANTAGE', near))).toBe(false)
      expect(attackRestrictionsMet(restrictions, circumstances('NORMAL'))).toBe(false)
    })

    it('reports whether an Effect asks about nearby enemies, for the planner to load them', () => {
      expect(effectReadsEnemyProximity(restrictedEffect(riderGate([ENEMY_WITHIN_5])))).toBe(true)
      expect(effectReadsEnemyProximity(restrictedEffect(riderGate([ADVANTAGE])))).toBe(false)
      expect(effectReadsEnemyProximity(restrictedEffect(undefined))).toBe(false)
    })
  })

  it('refuses restrictions that still hold weapon checks', () => {
    expect(() => attackRestrictionsMet(riderGate([FINESSE]), circumstances('NORMAL'))).toThrow(
      'Attack restrictions must be reduced to circumstance checks.'
    )
  })
})
