import type { EffectAuthored, FacetAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { pathOfTheBerserker } from '@artificer-toolkit/source-data/srd/classes/path-of-the-berserker.js'
import { describe, expect, it } from 'vitest'

import {
  attackRestrictionsMet,
  effectReadsEnemyProximity,
  effectReadsMoveToward,
  effectReadsTurnUses,
  oncePerTurnUsageKey,
  reduceEffectRestrictions,
  spentTurnUses,
  type Dnd5eAttackCircumstances
} from '../systems/dnd5e/attackRestrictions.js'
import type { Dnd5eAttackingItem } from '../systems/dnd5e/modifierApplicability.js'
import { mergeOnHitRiders, collectOnHitRiders } from '../character/characterOnHitRiders.js'
import { dealsDamageTypeGate } from '../testing/crusher.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  oncePerTurnSneakAttack,
  riderGate,
  type RiderGateCondition
} from '../testing/unconditionalSneakAttack.js'

const ADVANTAGE = { predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'ADVANTAGE' } as const
const NOT_DISADVANTAGE = {
  predicateCode: 'ATTACK_ROLL_MODE',
  rollMode: 'DISADVANTAGE',
  negated: true
} as const
const ENEMY_WITHIN_5 = { predicateCode: 'ENEMY_NEAR_TARGET', feet: 5 } as const
const MOVED_20 = { predicateCode: 'MOVED_TOWARD_TARGET', minFeet: 20 } as const
const FINESSE = { predicateCode: 'EQUIPMENT_PROPERTY', properties: ['FINESSE'] } as const

type FacetContext = FacetAuthored['groups'][number]['contexts'][number]

const circumstances = (
  rollMode: Dnd5eAttackCircumstances['rollMode'],
  enemyProximity: Dnd5eAttackCircumstances['enemyProximity'] = null,
  targetCreatureTypeId: Dnd5eAttackCircumstances['targetCreatureTypeId'] = null,
  moveToward: Dnd5eAttackCircumstances['moveToward'] = null,
  attackItemBindingEffectIds: Dnd5eAttackCircumstances['attackItemBindingEffectIds'] = []
): Dnd5eAttackCircumstances => ({
  rollMode,
  enemyProximity,
  targetCreatureTypeId,
  moveToward,
  attackItemBindingEffectIds
})

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

  it('leaves an ON_USE path’s holder restrictions as authored (Frenzy, SPELLS-31.T5f4)', () => {
    const authored = pathOfTheBerserker.features?.find(({ label }) => label === 'Frenzy')
      ?.effects?.[0]
    if (!authored) throw new Error('The SRD Berserker has no Frenzy effect.')
    const frenzy = compileEffect(authored)
    expect(restrictionsOf(frenzy)).not.toEqual([undefined])
    expect(reduceEffectRestrictions(frenzy, longsword)).toBe(frenzy)
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
    expect(attackRestrictionsMet(reducedOf([NOT_DISADVANTAGE]), circumstances(rollMode))).toBe(
      expected
    )
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
        attackRestrictionsMet(reducedOf([ENEMY_WITHIN_5]), circumstances('NORMAL', { nearestFeet }))
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
      for (const check of [ENEMY_WITHIN_5, { ...ENEMY_WITHIN_5, constraint: 'EXCLUDE' } as const])
        expect(attackRestrictionsMet(reducedOf([check]), circumstances('NORMAL'))).toBe(false)
    })

    it('inverts an excluded check once the Scene measured', () => {
      const restrictions = reducedOf([{ ...ENEMY_WITHIN_5, constraint: 'EXCLUDE' }])
      expect(attackRestrictionsMet(restrictions, circumstances('NORMAL', { nearestFeet: 5 }))).toBe(
        false
      )
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

  describe('a move toward the target', () => {
    const measured = (closedFeet: number) => circumstances('NORMAL', null, null, { closedFeet })

    it.each([
      [0, false],
      [15, false],
      [20, true],
      [35, true]
    ])('requires closing 20 ft: closed %s ft -> %s', (closedFeet, expected) => {
      expect(attackRestrictionsMet(reducedOf([MOVED_20]), measured(closedFeet))).toBe(expected)
    })

    it('has no answer without a Scene, whatever its constraint', () => {
      for (const check of [MOVED_20, { ...MOVED_20, constraint: 'EXCLUDE' } as const])
        expect(attackRestrictionsMet(reducedOf([check]), circumstances('NORMAL'))).toBe(false)
    })

    it('inverts an excluded check once the move was measured', () => {
      const restrictions = reducedOf([{ ...MOVED_20, constraint: 'EXCLUDE' }])
      expect(attackRestrictionsMet(restrictions, measured(20))).toBe(false)
      expect(attackRestrictionsMet(restrictions, measured(5))).toBe(true)
    })

    it('reports whether an Effect asks about the move, for the planner to load it', () => {
      expect(effectReadsMoveToward(restrictedEffect(riderGate([MOVED_20])))).toBe(true)
      expect(effectReadsMoveToward(restrictedEffect(riderGate([ADVANTAGE])))).toBe(false)
      expect(effectReadsMoveToward(restrictedEffect(undefined))).toBe(false)
    })
  })

  it('refuses restrictions that still hold weapon checks', () => {
    expect(() => attackRestrictionsMet(riderGate([FINESSE]), circumstances('NORMAL'))).toThrow(
      'Attack restrictions must be reduced to circumstance checks.'
    )
  })
})

describe('once-per-turn paths of a compiled attack Effect', () => {
  const limited = () => {
    const [authored] = oncePerTurnSneakAttack(testUuid(0xc01)).effects ?? []
    if (!authored) throw new Error('Expected the rider Effect.')
    return compileEffect(authored)
  }

  it('reports that the Effect reads the turn record, for the planner to load it', () => {
    expect(effectReadsTurnUses(limited())).toBe(true)
    expect(effectReadsTurnUses(restrictedEffect(undefined))).toBe(false)
  })

  it('keys a limited entry by its own Effect', () => {
    const effect = limited()
    expect(new Set(effect.entries.map((entry) => oncePerTurnUsageKey(entry, effect.id)))).toEqual(
      new Set([effect.id])
    )
    expect(oncePerTurnUsageKey(restrictedEffect(undefined).entries[0]!, effect.id)).toBeNull()
  })

  it('keys a rider merged from a Feature by that Feature, so its Effects share one use', () => {
    const effect = limited()
    const merged = effect.entries.map((entry) => ({ ...entry, usageKey: 'feature-1' }))
    expect(new Set(merged.map((entry) => oncePerTurnUsageKey(entry, effect.id)))).toEqual(
      new Set(['feature-1'])
    )
  })

  it('spends a use only for an entry the attack dealt', () => {
    const effect = limited()
    const [entry] = effect.entries
    expect(spentTurnUses(effect, new Set([entry!.entryId]))).toEqual([effect.id])
    expect(spentTurnUses(effect, new Set())).toEqual([])
  })
})

describe('target creature-type checks of reduced restrictions', () => {
  const UNDEAD = testUuid(0xf01)
  const FIEND = testUuid(0xf02)
  const BEAST = testUuid(0xf03)

  const weaponContext = (check: typeof FINESSE): FacetContext => ({
    id: testUuid(0xf14),
    order: 1,
    subject: 'EQUIPMENT',
    authoringModeKind: 'ALL',
    conditions: [
      {
        id: testUuid(0xf15),
        order: 0,
        kind: 'PREDICATE',
        constraint: 'INCLUDE',
        predicateCode: check.predicateCode,
        properties: [...check.properties],
        authoringModeKind: 'SELECTED'
      }
    ]
  })

  /** A group holding a creature-type check on the target and, optionally, a check on the weapon. */
  const creatureTypeGate = (
    constraint: 'INCLUDE' | 'EXCLUDE',
    weaponCheck?: typeof FINESSE
  ): FacetAuthored => ({
    id: testUuid(0xf10),
    groups: [
      {
        id: testUuid(0xf11),
        order: 0,
        contexts: [
          {
            id: testUuid(0xf12),
            order: 0,
            subject: 'CREATURE',
            authoringModeKind: 'ALL',
            conditions: [
              {
                id: testUuid(0xf13),
                order: 0,
                kind: 'PREDICATE',
                constraint,
                predicateCode: 'CREATURE_TYPE',
                authoringModeKind: 'SELECTED',
                creatureTypeIds: [UNDEAD, FIEND]
              }
            ]
          },
          ...(weaponCheck ? [weaponContext(weaponCheck)] : [])
        ]
      }
    ]
  })

  const reducedOf = (gate: FacetAuthored, item: Dnd5eAttackingItem = rapier) => {
    const [restrictions] = restrictionsOf(reduceEffectRestrictions(restrictedEffect(gate), item))
    if (!restrictions) throw new Error('Expected a remaining creature-type check.')
    return restrictions
  }

  it.each([
    [UNDEAD, true],
    [FIEND, true],
    [BEAST, false],
    [null, false]
  ] as const)('owes a type-gated entry to a %s target: %s', (typeId, expected) => {
    expect(
      attackRestrictionsMet(
        reducedOf(creatureTypeGate('INCLUDE')),
        circumstances('NORMAL', null, typeId)
      )
    ).toBe(expected)
  })

  it('inverts an excluded creature type', () => {
    const restrictions = reducedOf(creatureTypeGate('EXCLUDE'))
    expect(attackRestrictionsMet(restrictions, circumstances('NORMAL', null, UNDEAD))).toBe(false)
    expect(attackRestrictionsMet(restrictions, circumstances('NORMAL', null, BEAST))).toBe(true)
  })

  it('settles the weapon check first and leaves only the target check', () => {
    const gate = creatureTypeGate('INCLUDE', FINESSE)
    expect(restrictionsOf(reduceEffectRestrictions(restrictedEffect(gate), longsword))).toEqual([])
    expect(
      attackRestrictionsMet(reducedOf(gate, rapier), circumstances('NORMAL', null, FIEND))
    ).toBe(true)
  })
})

describe('binding-Effect checks of reduced restrictions (SPELLS-31.T4v)', () => {
  const PACT = testUuid(0xb01)
  const OTHER = testUuid(0xb02)

  /** A group holding a check that the attacking weapon is bound by one of `effectIds`. */
  const bindingGate = (
    constraint: 'INCLUDE' | 'EXCLUDE',
    weaponCheck?: typeof FINESSE
  ): FacetAuthored => ({
    id: testUuid(0xb10),
    groups: [
      {
        id: testUuid(0xb11),
        order: 0,
        contexts: [
          {
            id: testUuid(0xb12),
            order: 0,
            subject: 'EQUIPMENT',
            authoringModeKind: 'ALL',
            conditions: [
              {
                id: testUuid(0xb13),
                order: 0,
                kind: 'PREDICATE',
                constraint,
                predicateCode: 'BOUND_BY_EFFECT',
                effectIds: [PACT]
              },
              ...(weaponCheck
                ? [
                    {
                      id: testUuid(0xb14),
                      order: 1,
                      kind: 'PREDICATE' as const,
                      constraint: 'INCLUDE' as const,
                      predicateCode: weaponCheck.predicateCode,
                      properties: [...weaponCheck.properties],
                      authoringModeKind: 'SELECTED' as const
                    }
                  ]
                : [])
            ]
          }
        ]
      }
    ]
  })

  const bound = (...effectIds: string[]) => circumstances('NORMAL', null, null, null, effectIds)

  it('keeps the binding check for the moment the attack rolls', () => {
    const [restrictions] = restrictionsOf(
      reduceEffectRestrictions(restrictedEffect(bindingGate('INCLUDE')), longsword)
    )
    if (!restrictions) throw new Error('Expected the binding check to remain.')
    expect(attackRestrictionsMet(restrictions, bound(PACT))).toBe(true)
    expect(attackRestrictionsMet(restrictions, bound(OTHER, PACT))).toBe(true)
    expect(attackRestrictionsMet(restrictions, bound(OTHER))).toBe(false)
    expect(attackRestrictionsMet(restrictions, bound())).toBe(false)
  })

  it('inverts an excluded binding check', () => {
    const [restrictions] = restrictionsOf(
      reduceEffectRestrictions(restrictedEffect(bindingGate('EXCLUDE')), longsword)
    )
    if (!restrictions) throw new Error('Expected the binding check to remain.')
    expect(attackRestrictionsMet(restrictions, bound(PACT))).toBe(false)
    expect(attackRestrictionsMet(restrictions, bound())).toBe(true)
  })

  it('settles the weapon check beside it first', () => {
    const gate = bindingGate('INCLUDE', FINESSE)
    expect(restrictionsOf(reduceEffectRestrictions(restrictedEffect(gate), longsword))).toEqual([])
    const [restrictions] = restrictionsOf(reduceEffectRestrictions(restrictedEffect(gate), rapier))
    if (!restrictions) throw new Error('Expected the binding check to remain.')
    expect(attackRestrictionsMet(restrictions, bound(PACT))).toBe(true)
    expect(attackRestrictionsMet(restrictions, bound())).toBe(false)
  })
})

describe('damage-type checks of reduced restrictions', () => {
  const BLUDGEONING = testUuid(0xe01)
  const SLASHING = testUuid(0xe02)

  /** A melee weapon hit dealing the given types, ridden by the restricted rider. */
  const riddenHit = (gate: FacetAuthored, damageTypeIds: readonly string[]) => {
    const weapon = compileEffect({
      id: testUuid(0xe10),
      order: 1,
      invocation: {
        triggerCode: 'MELEE_WEAPON_ATTACK',
        activation: { code: 'ACTION', amount: 1 },
        range: { id: testUuid(0xe11), rangeKind: 'SELF' }
      },
      paths: [
        {
          id: testUuid(0xe12),
          order: 1,
          pathCode: 'ON_HIT',
          groupType: 'SINGLE',
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: testUuid(0xe13),
            resultKind: 'SINGLE',
            outcomes: damageTypeIds.map((damageTypeId, index) => ({
              id: testUuid(0xe20 + index),
              effectKind: 'DAMAGE' as const,
              damageTypeId,
              valueKind: 'FIXED' as const,
              scalingKind: 'NONE' as const,
              amount: 1
            }))
          }
        }
      ]
    })
    return reduceEffectRestrictions(
      mergeOnHitRiders(
        weapon,
        collectOnHitRiders([restrictedEffect(gate)], testUuid(0xe30)),
        testUuid(0xe31)
      ),
      longsword
    )
  }

  it('owes the entry when the hit deals the type, and lifts the check', () => {
    const effect = riddenHit(dealsDamageTypeGate(BLUDGEONING), [BLUDGEONING])
    expect(effect.entries).toHaveLength(2)
    expect(restrictionsOf(effect)).toEqual([undefined, undefined])
  })

  it('owes the entry when any of the hit’s damage is of the type', () => {
    expect(
      riddenHit(dealsDamageTypeGate(BLUDGEONING), [SLASHING, BLUDGEONING]).entries
    ).toHaveLength(3)
  })

  it('removes the entry when the hit deals no damage of the type', () => {
    expect(riddenHit(dealsDamageTypeGate(BLUDGEONING), [SLASHING]).entries).toHaveLength(1)
  })

  it('inverts an excluded damage type', () => {
    const excluded = dealsDamageTypeGate(BLUDGEONING, 'EXCLUDE')
    expect(riddenHit(excluded, [BLUDGEONING]).entries).toHaveLength(1)
    expect(riddenHit(excluded, [SLASHING]).entries).toHaveLength(2)
  })
})
