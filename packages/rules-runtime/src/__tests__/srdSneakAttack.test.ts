import { rogue } from '@artificer-toolkit/source-data/srd/classes/rogue.js'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import { collectOnHitRiders } from '../character/characterOnHitRiders.js'
import {
  attackRestrictionsMet,
  effectReadsEnemyProximity,
  effectReadsTurnUses,
  oncePerTurnUsageKey,
  reduceEffectRestrictions,
  type Dnd5eAttackCircumstances
} from '../systems/dnd5e/attackRestrictions.js'
import type { Dnd5eAttackingItem } from '../systems/dnd5e/modifierApplicability.js'

const feature = rogue.features?.find((candidate) => candidate.label === 'Sneak Attack')
if (!feature?.effects) throw new Error('The SRD Rogue has no Sneak Attack Feature.')
const [melee, ranged] = feature.effects.map((effect) => compileEffect(effect))
if (!melee || !ranged) throw new Error('Sneak Attack must author a melee and a ranged Effect.')

const weapon = (properties: Dnd5eAttackingItem['properties']): Dnd5eAttackingItem => ({
  equipmentIds: [],
  category: 'WEAPON',
  properties,
  grip: 'ONE_HANDED',
  otherWeaponEquipped: false
})
const rapier = weapon(['FINESSE'])
const longsword = weapon([])
const longbow = weapon(['AMMUNITION'])

const circumstances = (
  rollMode: Dnd5eAttackCircumstances['rollMode'],
  nearestFeet: number | null | undefined = undefined
): Dnd5eAttackCircumstances => ({
  rollMode,
  enemyProximity: nearestFeet === undefined ? null : { nearestFeet },
  targetCreatureTypeId: null,
  moveToward: null
})

/** Whether the reduced Effect still owes its Sneak Attack entry for these circumstances. */
function owed(
  effect: typeof melee,
  item: Dnd5eAttackingItem,
  attack: Dnd5eAttackCircumstances
): boolean {
  const [entry] = reduceEffectRestrictions(effect, item).entries
  if (!entry) return false
  return (
    !('restrictions' in entry && entry.restrictions) ||
    attackRestrictionsMet(entry.restrictions, attack)
  )
}

describe('the SRD Rogue’s Sneak Attack, authored from core options', () => {
  it('is an ON_HIT rider, limited to once per turn, keyed by its Feature', () => {
    for (const effect of [melee, ranged]) {
      expect(effectReadsTurnUses(effect)).toBe(true)
      expect(effectReadsEnemyProximity(effect)).toBe(true)
    }
    const riders = collectOnHitRiders([melee, ranged], feature.id)
    expect(riders.map((rider) => rider.triggerCode)).toEqual([
      'MELEE_WEAPON_ATTACK',
      'RANGED_WEAPON_ATTACK'
    ])
    const keys = riders.flatMap((rider) =>
      rider.entries.map((entry) => oncePerTurnUsageKey(entry, 'unused'))
    )
    expect(new Set(keys)).toEqual(new Set([feature.id]))
  })

  it('needs a finesse weapon for a melee attack', () => {
    expect(reduceEffectRestrictions(melee, longsword).entries).toEqual([])
    expect(reduceEffectRestrictions(melee, rapier).entries).not.toHaveLength(0)
  })

  it('asks nothing of the weapon for a ranged attack', () => {
    expect(reduceEffectRestrictions(ranged, longbow).entries).not.toHaveLength(0)
  })

  describe.each([
    ['a finesse melee attack', melee, rapier],
    ['a ranged attack', ranged, longbow]
  ] as const)('on %s', (_name, effect, item) => {
    it('is owed with advantage, even with no enemy near', () => {
      expect(owed(effect, item, circumstances('ADVANTAGE', null))).toBe(true)
      expect(owed(effect, item, circumstances('ADVANTAGE'))).toBe(true)
    })

    it('is owed without advantage when an able enemy stands within 5 feet of the target', () => {
      expect(owed(effect, item, circumstances('NORMAL', 5))).toBe(true)
    })

    it('is not owed with disadvantage, an enemy near or not', () => {
      expect(owed(effect, item, circumstances('DISADVANTAGE', 5))).toBe(false)
      expect(owed(effect, item, circumstances('DISADVANTAGE', 0))).toBe(false)
    })

    it('is not owed without advantage when no enemy is near or the Scene cannot say', () => {
      expect(owed(effect, item, circumstances('NORMAL', 10))).toBe(false)
      expect(owed(effect, item, circumstances('NORMAL', null))).toBe(false)
      expect(owed(effect, item, circumstances('NORMAL'))).toBe(false)
    })
  })
})
