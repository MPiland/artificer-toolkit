import { describe, expect, it } from 'vitest'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { OPTIONAL_SMITE_EFFECT_ID } from '../testing/optionalSmite.js'
import { outcomeDice, srdDamageTypeId } from './encounterCreatureAction.js'
import {
  HIT,
  NATURAL_20,
  SMITE_OCCURRENCE_ID,
  damage,
  scriptedRolls,
  smiteRuntime,
  smiteTargetBinding,
  smiterWeaponAttack
} from './optionalSmiteAttack.js'

const RADIANT = srdDamageTypeId('RADIANT')
const SLASHING = srdDamageTypeId('SLASHING')

/** The Longsword hit with the player's choice (the rider and the slot level paid), or none. */
async function longswordHit(input: {
  rolls: number[]
  smite?: { castLevel: number }
  resistantTo?: string
}) {
  const { plan, actionMechanic, decision } = smiterWeaponAttack('Longsword', {
    attackKind: 'MELEE',
    grip: 'ONE_HANDED'
  })
  const rolls = scriptedRolls(input.rolls)
  const execution = await executeNativeActionGraphs({
    runtime: smiteRuntime(),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan,
    occurrenceId: SMITE_OCCURRENCE_ID,
    binding: smiteTargetBinding(
      input.smite
        ? {
            ...actionMechanic,
            spellCastLevel: input.smite.castLevel,
            selectedOptionalRiderIds: [OPTIONAL_SMITE_EFFECT_ID]
          }
        : actionMechanic,
      { resistantTo: input.resistantTo }
    ),
    afterTest: async () => undefined,
    random: rolls.next
  })
  expect(rolls.remaining()).toEqual([])
  return { execution, decision }
}

describe('an optional on-hit rider joins the weapon hit only when chosen (D123)', () => {
  it('adds nothing when the player does not choose the rider', async () => {
    const { execution } = await longswordHit({ rolls: [HIT, 3] })
    expect(outcomeDice(execution).hit).toEqual(['d8'])
    expect(damage(execution)).toEqual([
      { requested: 4 + 3, resolved: 4 + 3, damageTypeId: SLASHING }
    ])
  })

  it('adds the dice row of the chosen slot level to the weapon damage, as its own type', async () => {
    // A 2nd-level slot is 3d8: the weapon rolls first, then the rider's three dice.
    const { execution } = await longswordHit({
      rolls: [HIT, 3, 0, 1, 2],
      smite: { castLevel: 2 }
    })
    expect(outcomeDice(execution).hit).toEqual(['d8', 'd8', 'd8', 'd8'])
    expect(damage(execution)).toEqual([
      { requested: 4 + 3, resolved: 4 + 3, damageTypeId: SLASHING },
      { requested: 1 + 2 + 3, resolved: 1 + 2 + 3, damageTypeId: RADIANT }
    ])
  })

  it.each([
    [1, 2],
    [3, 4],
    [4, 5],
    [5, 5],
    [9, 5]
  ])('rolls the row of a level %i slot: %i dice, no more than 5', async (castLevel, count) => {
    const { execution } = await longswordHit({
      rolls: [HIT, 3, ...Array.from({ length: count }, () => 0)],
      smite: { castLevel }
    })
    expect(outcomeDice(execution).hit).toEqual(['d8', ...Array.from({ length: count }, () => 'd8')])
  })

  it('doubles the rider dice on a critical hit', async () => {
    // A 2nd-level slot on a critical hit rolls 2d8 + 3 for the weapon and 6d8 radiant.
    const { execution } = await longswordHit({
      rolls: [NATURAL_20, 3, 6, 0, 1, 2, 3, 4, 5],
      smite: { castLevel: 2 }
    })
    expect(execution.d20).toMatchObject({ resultPath: 'ON_CRIT' })
    expect(damage(execution).map((part) => part.requested)).toEqual([
      4 + 7 + 3,
      1 + 2 + 3 + 4 + 5 + 6
    ])
  })

  it('resists the rider like any damage of its type', async () => {
    const { execution } = await longswordHit({
      rolls: [HIT, 3, 0, 1, 2],
      smite: { castLevel: 2 },
      resistantTo: RADIANT
    })
    expect(damage(execution)).toEqual([
      { requested: 7, resolved: 7, damageTypeId: SLASHING },
      { requested: 6, resolved: 3, damageTypeId: RADIANT }
    ])
  })

  it('never lists the rider on the Sheet action card', async () => {
    const { decision } = await longswordHit({ rolls: [HIT, 3] })
    expect(decision.mechanic.outcomes.filter((outcome) => outcome.kind === 'DAMAGE')).toHaveLength(
      1
    )
  })
})
