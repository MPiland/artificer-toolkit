import { SRD_CREATURE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { SRD, evaluateSrdCharacter, srdByLabel, srdFeature } from '../testing/dnd5eSrdCharacter.js'
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

/**
 * The SRD Paladin's Divine Smite and Improved Divine Smite, authored from core options only
 * (ATTACK-9.4). Every die rolls a 1, so a radiant total counts dice.
 */

const RADIANT = srdDamageTypeId('RADIANT')
const PALADIN = srdByLabel(SRD.classes, 'Paladin')
const DIVINE_SMITE_RIDER_ID = srdByLabel(PALADIN.features ?? [], 'Divine Smite').effects![0]!.id
const creatureType = (code: string) => {
  const entry = SRD_CREATURE_TYPES.find((candidate) => candidate.code === code)
  if (!entry) throw new Error(`SRD creature type ${code} is missing.`)
  return entry.id
}

type Weapon = 'Longsword' | 'Light Crossbow'
const weaponAction = (weapon: Weapon) =>
  weapon === 'Longsword'
    ? ({ attackKind: 'MELEE', grip: 'ONE_HANDED' } as const)
    : ({ attackKind: 'RANGED' } as const)

/** A Paladin of the given level with the SRD smite Features it has reached, wielding the weapon. */
function paladin(level: number, weapon: Weapon) {
  return evaluateSrdCharacter({
    abilities: { STRENGTH: 16, DEXTERITY: 16 },
    classes: [{ label: 'Paladin', level }],
    items: [{ label: weapon, equipped: true }],
    features: [
      srdFeature({ owner: 'CLASS', classLabel: 'Paladin', featureLabel: 'Divine Smite', level: 2 }),
      ...(level >= 11
        ? [
            srdFeature({
              owner: 'CLASS',
              classLabel: 'Paladin',
              featureLabel: 'Improved Divine Smite',
              level: 11
            })
          ]
        : [])
    ]
  })
}

const offeredRiderIds = (compilerSource: ReturnType<typeof smiterWeaponAttack>['compilerSource']) =>
  dnd5eCharacterRuleActionSystemAdapter
    .optionalOnHitRiders({ compilerSource })
    .map(({ riderId }) => riderId)

/** The weapon hit, with the player's choice of slot level (none: Divine Smite declined) and the target's type. */
async function paladinHit(input: {
  level: number
  weapon?: Weapon
  d20: number
  /** How many dice follow the d20: the weapon's, then each rider's. */
  dice: number
  smiteSlotLevel?: number
  targetType?: string
}) {
  const weapon = input.weapon ?? 'Longsword'
  const attack = smiterWeaponAttack(weapon, weaponAction(weapon), paladin(input.level, weapon))
  const rolls = scriptedRolls([input.d20, ...Array.from({ length: input.dice }, () => 0)])
  const execution = await executeNativeActionGraphs({
    runtime: smiteRuntime(),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan: attack.plan,
    occurrenceId: SMITE_OCCURRENCE_ID,
    binding: smiteTargetBinding(
      input.smiteSlotLevel
        ? {
            ...attack.actionMechanic,
            spellCastLevel: input.smiteSlotLevel,
            selectedOptionalRiderIds: [DIVINE_SMITE_RIDER_ID]
          }
        : attack.actionMechanic,
      input.targetType ? { creatureTypeId: input.targetType } : {}
    ),
    afterTest: async () => undefined,
    random: rolls.next
  })
  expect(rolls.remaining()).toEqual([])
  return { execution, attack }
}

const radiant = (execution: Awaited<ReturnType<typeof paladinHit>>['execution']) =>
  damage(execution)
    .filter((part) => part.damageTypeId === RADIANT)
    .reduce((total, part) => total + part.requested, 0)

describe('SRD Divine Smite (ATTACK-9.4)', () => {
  it('adds nothing when the player does not spend a slot', async () => {
    const { execution } = await paladinHit({ level: 5, d20: HIT, dice: 1 })
    expect(radiant(execution)).toBe(0)
  })

  it.each([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 5],
    [9, 5]
  ])('a level %i slot adds %i d8 radiant, never more than 5d8', async (slotLevel, dice) => {
    const { execution } = await paladinHit({
      level: 5,
      d20: HIT,
      dice: 1 + dice,
      smiteSlotLevel: slotLevel
    })
    expect(outcomeDice(execution).hit).toEqual(Array.from({ length: 1 + dice }, () => 'd8'))
    expect(radiant(execution)).toBe(dice)
  })

  it.each(['UNDEAD', 'FIEND'])('adds 1d8 against a %s', async (code) => {
    const { execution } = await paladinHit({
      level: 5,
      d20: HIT,
      dice: 1 + 3 + 1,
      smiteSlotLevel: 2,
      targetType: creatureType(code)
    })
    expect(radiant(execution)).toBe(3 + 1)
  })

  it('adds nothing against another creature type', async () => {
    const { execution } = await paladinHit({
      level: 5,
      d20: HIT,
      dice: 1 + 3,
      smiteSlotLevel: 2,
      targetType: creatureType('BEAST')
    })
    expect(radiant(execution)).toBe(3)
  })

  it('doubles every smite die on a critical hit', async () => {
    const { execution } = await paladinHit({
      level: 5,
      d20: NATURAL_20,
      dice: 2 + 2 * (3 + 1),
      smiteSlotLevel: 2,
      targetType: creatureType('FIEND')
    })
    expect(execution.d20).toMatchObject({ resultPath: 'ON_CRIT' })
    expect(radiant(execution)).toBe(2 * (3 + 1))
  })

  it('is not owed to a ranged weapon hit, even with the rider chosen', async () => {
    const { execution } = await paladinHit({
      level: 5,
      weapon: 'Light Crossbow',
      d20: HIT,
      dice: 1,
      smiteSlotLevel: 2
    })
    expect(radiant(execution)).toBe(0)
  })

  it('is offered for a melee weapon hit and not for a ranged one', () => {
    const offered = (weapon: Weapon) =>
      offeredRiderIds(
        smiterWeaponAttack(weapon, weaponAction(weapon), paladin(5, weapon)).compilerSource
      )
    expect(offered('Longsword')).toEqual([DIVINE_SMITE_RIDER_ID])
    expect(offered('Light Crossbow')).toEqual([])
  })
})

describe('SRD Improved Divine Smite (ATTACK-9.4)', () => {
  it('adds 1d8 radiant to every melee weapon hit, and offers only Divine Smite', async () => {
    const { execution, attack } = await paladinHit({ level: 11, d20: HIT, dice: 1 + 1 })
    expect(radiant(execution)).toBe(1)
    expect(offeredRiderIds(attack.compilerSource)).toEqual([DIVINE_SMITE_RIDER_ID])
  })

  it('doubles on a critical hit', async () => {
    const { execution } = await paladinHit({ level: 11, d20: NATURAL_20, dice: 2 + 2 })
    expect(radiant(execution)).toBe(2)
  })

  it('stacks with a chosen Divine Smite', async () => {
    const { execution } = await paladinHit({
      level: 11,
      d20: HIT,
      dice: 1 + 1 + 3,
      smiteSlotLevel: 2
    })
    expect(radiant(execution)).toBe(1 + 3)
  })

  it('is not owed to a ranged weapon hit', async () => {
    const { execution } = await paladinHit({
      level: 11,
      weapon: 'Light Crossbow',
      d20: HIT,
      dice: 1
    })
    expect(radiant(execution)).toBe(0)
  })
})
