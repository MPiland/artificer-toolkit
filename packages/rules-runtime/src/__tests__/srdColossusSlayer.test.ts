import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { describe, expect, it } from 'vitest'

import { collectOnHitRiders } from '../character/characterOnHitRiders.js'
import {
  attackRestrictionsMet,
  effectReadsTurnUses,
  oncePerTurnUsageKey,
  reduceEffectRestrictions,
  type Dnd5eAttackCircumstances
} from '../systems/dnd5e/attackRestrictions.js'
import type { Dnd5eAttackingItem } from '../systems/dnd5e/modifierApplicability.js'

const prey = hunterConclave.features?.find((candidate) => candidate.label === "Hunter's Prey")
const option = prey?.options?.find((candidate) => candidate.label === 'Colossus Slayer')
if (!option?.effects) throw new Error('The SRD Hunter has no Colossus Slayer option.')
const [melee, ranged] = option.effects.map((effect) => compileEffect(effect))
if (!melee || !ranged) throw new Error('Colossus Slayer must author a melee and a ranged Effect.')

const weapon = (properties: Dnd5eAttackingItem['properties']): Dnd5eAttackingItem => ({
  equipmentIds: [],
  category: 'WEAPON',
  properties,
  grip: 'ONE_HANDED',
  otherWeaponEquipped: false
})
const longsword = weapon([])
const longbow = weapon(['AMMUNITION'])

const circumstances = (targetBelowMaximumHitPoints: boolean): Dnd5eAttackCircumstances => ({
  rollMode: 'NORMAL',
  enemyProximity: null,
  targetCreatureTypeId: null,
  targetBelowMaximumHitPoints,
  moveToward: null,
  attackItemBindingEffectIds: []
})

/** Whether the reduced Effect still owes its Colossus Slayer entry for these circumstances. */
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

describe('the SRD Hunter’s Colossus Slayer, authored from core options', () => {
  it('is an ON_HIT rider, limited to once per turn, keyed by its option', () => {
    for (const effect of [melee, ranged]) expect(effectReadsTurnUses(effect)).toBe(true)
    const riders = collectOnHitRiders([melee, ranged], option.id, option.label)
    expect(riders.map((rider) => rider.triggerCode)).toEqual([
      'MELEE_WEAPON_ATTACK',
      'RANGED_WEAPON_ATTACK'
    ])
    const keys = riders.flatMap((rider) =>
      rider.entries.map((entry) => oncePerTurnUsageKey(entry, 'unused'))
    )
    expect(new Set(keys)).toEqual(new Set([option.id]))
  })

  it('asks nothing of the weapon', () => {
    expect(reduceEffectRestrictions(melee, longsword).entries).not.toHaveLength(0)
    expect(reduceEffectRestrictions(ranged, longbow).entries).not.toHaveLength(0)
  })

  describe.each([
    ['a melee attack', melee, longsword],
    ['a ranged attack', ranged, longbow]
  ] as const)('on %s', (_name, effect, item) => {
    it('is owed when the target is below its hit point maximum', () => {
      expect(owed(effect, item, circumstances(true))).toBe(true)
    })

    it('is not owed when the target is at its hit point maximum', () => {
      expect(owed(effect, item, circumstances(false))).toBe(false)
    })
  })
})
