import type { FacetAuthored } from '@artificer-toolkit/shared/authored'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { prepareNativeCharacterActionState } from '../character/characterNativeActionResources.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import {
  buildCompiledActionCompilerSource,
  compileCharacterActionEntryPoints
} from '../encounterActionEntryPointCompiler.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import type { EnemyProximity } from '../encounterEnemyProximity.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  UNCONDITIONAL_SNEAK_ATTACK_ID,
  gatedSneakAttack,
  riderGate,
  unconditionalSneakAttack
} from '../testing/unconditionalSneakAttack.js'
import {
  SRD,
  evaluateSrdCharacter,
  itemAction,
  srdByLabel,
  srdFeature
} from '../testing/dnd5eSrdCharacter.js'
import { outcomeDice, srdDamageTypeId } from './encounterCreatureAction.js'

const TARGET_ID = testUuid(0xc2)
/** Ordinary and natural-20 d20 faces (0-based), against the target's Armor Class 11. */
const HIT = 14
const NATURAL_20 = 19
const ROGUE = srdByLabel(SRD.classes, 'Rogue')

/**
 * A Rogue of the given level (optionally multiclassed with Fighter levels) wielding an equipped
 * weapon (a Longsword unless named), with or without the homebrew rider, which a gate may narrow.
 */
function rogue(input: {
  level: number
  fighterLevel?: number
  withRider: boolean
  gate?: FacetAuthored
  weapon?: 'Longsword' | 'Rapier'
}) {
  return evaluateSrdCharacter({
    abilities: { STRENGTH: 16 },
    classes: [
      ...(input.fighterLevel ? [{ label: 'Fighter', level: input.fighterLevel }] : []),
      { label: 'Rogue', level: input.level }
    ],
    items: [{ label: input.weapon ?? 'Longsword', equipped: true }],
    extraFeatures: input.withRider
      ? [input.gate ? gatedSneakAttack(ROGUE.id, input.gate) : unconditionalSneakAttack(ROGUE.id)]
      : [],
    features: input.withRider
      ? [
          {
            acquisitionId: 'acquired:unconditional-sneak-attack',
            featureId: UNCONDITIONAL_SNEAK_ATTACK_ID,
            source: { kind: 'CLASS', classId: ROGUE.id, classLevel: 1 },
            timing: { kind: 'CLASS_LEVEL', classId: ROGUE.id, classLevel: 1 }
          }
        ]
      : []
  })
}

/**
 * The Rogue's one-handed weapon hit against an unarmored target, every roll a 0-based face. An
 * `influence` is a source-side d20 contributor on melee attacks (advantage or disadvantage).
 */
async function longswordHit(input: {
  level: number
  fighterLevel?: number
  rolls: number[]
  resistantTo?: string
  gate?: FacetAuthored
  weapon?: 'Longsword' | 'Rapier'
  influence?: 'ADVANTAGE' | 'DISADVANTAGE'
  /** What the Scene measured of the target's enemies; absent for an attack without a Scene. */
  enemyProximity?: EnemyProximity
}) {
  const character = rogue({
    level: input.level,
    ...(input.fighterLevel === undefined ? {} : { fighterLevel: input.fighterLevel }),
    ...(input.gate === undefined ? {} : { gate: input.gate }),
    ...(input.weapon === undefined ? {} : { weapon: input.weapon }),
    withRider: true
  })
  const { candidate } = itemAction(character, input.weapon ?? 'Longsword', {
    attackKind: 'MELEE',
    grip: 'ONE_HANDED'
  })
  const descriptors = discoverCharacterActionCapabilities({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: character.facts.actionCandidates,
    conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    entryPoints: character.entryPoints
  })
  const index = character.facts.actionCandidates.indexOf(candidate)
  const action = descriptors[index]
  const entry = compileCharacterActionEntryPoints({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: character.facts.actionCandidates,
    descriptors
  })[index]
  if (!action || entry?.kind !== 'CHARACTER_ACTION' || entry.schemaVersion !== 4)
    throw new Error('The Longsword hit must compile to a v4 Character action.')
  if (entry.compilation.kind !== 'COMPILED') throw new Error('The Longsword hit must compile.')
  const plan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
  if (!plan) throw new Error('The Longsword hit has no execution plan.')
  const { actionMechanic } = prepareNativeCharacterActionState({
    entry: { ...entry, compilation: entry.compilation },
    candidate,
    policyOutput: character.output,
    resourceUsage: [],
    inventory: [],
    itemUsage: [],
    characterId: 'srd-character',
    expectedStreamVersion: 0,
    classLevels: character.facts.grantFoldFacts.base.classes,
    automationMode: 'ASSISTED',
    trackAmmunition: false,
    ammunition: null,
    overridable: false
  })
  const rolls = [...input.rolls]
  const execution = await executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan,
    occurrenceId: testUuid(0xc3),
    binding: {
      actionMechanic,
      sourceDerivedFacts: {
        ...(input.enemyProximity ? { attackEnemyProximity: input.enemyProximity } : {}),
        ...(input.influence
          ? {
              rollContributorEvidence: {
                attacks: {
                  MELEE: [
                    {
                      sourceId: testUuid(0xc4),
                      grantId: testUuid(0xc5),
                      domainKey: 'attacks.melee',
                      influence: input.influence,
                      source: { kind: 'AUTHORED', id: testUuid(0xc6), holderActorId: null }
                    }
                  ]
                }
              }
            }
          : {})
      },
      targetActorId: TARGET_ID,
      targetDerivedFacts: { statBlock: { armorClass: 11 } },
      targetConditionIds: [],
      currentHitPoints: 59,
      temporaryHitPoints: 0,
      maximumHitPoints: 59,
      targetScalarValues: {},
      defenses: input.resistantTo ? [{ kind: 'RESISTANCE', damageTypeId: input.resistantTo }] : []
    },
    afterTest: async () => undefined,
    random: (maxExclusive) => {
      const value = rolls.shift()
      if (value === undefined || value >= maxExclusive)
        throw new Error(`Unexpected random call (max ${maxExclusive}).`)
      return value
    }
  })
  expect(rolls).toEqual([])
  return execution
}

function damage(execution: Awaited<ReturnType<typeof longswordHit>>) {
  return execution.applications.flatMap((application) =>
    application.kind === 'DAMAGE'
      ? [
          {
            requested: application.requestedAmount,
            resolved: application.resolvedAmount,
            damageTypeId: application.damageTypeId
          }
        ]
      : []
  )
}

const SLASHING = srdDamageTypeId('SLASHING')

describe('a passive Feature’s ON_HIT damage rides on the weapon hit (D119)', () => {
  it('adds the rider’s class-level dice to the weapon’s own damage, of the weapon’s damage type', async () => {
    // Rogue 5, Longsword 1d8 + 3, rider 3d6: the weapon rolls first, then the rider's three dice.
    const hit = await longswordHit({ level: 5, rolls: [HIT, 3, 0, 1, 2] })
    expect(outcomeDice(hit).hit).toEqual(['d8', 'd6', 'd6', 'd6'])
    expect(damage(hit)).toEqual([
      { requested: 4 + 3, resolved: 4 + 3, damageTypeId: SLASHING },
      { requested: 1 + 2 + 3, resolved: 1 + 2 + 3, damageTypeId: SLASHING }
    ])
  })

  it.each([
    [1, ['d6'], [0], [1]],
    [3, ['d6', 'd6'], [0, 1], [1 + 2]],
    [4, ['d6', 'd6'], [0, 1], [1 + 2]],
    [5, ['d6', 'd6', 'd6'], [0, 1, 2], [1 + 2 + 3]]
  ])(
    'selects the dice row of the Rogue’s class level (level %i)',
    async (level, dice, faces, riderTotal) => {
      const hit = await longswordHit({ level, rolls: [HIT, 3, ...faces] })
      expect(outcomeDice(hit).hit).toEqual(['d8', ...dice])
      expect(damage(hit).map((part) => part.requested)).toEqual([4 + 3, ...riderTotal])
    }
  )

  it('selects the dice row from the Rogue levels alone, not the Character’s total level', async () => {
    // Fighter 5 / Rogue 1 is a 6th-level Character with a 1st-level Rogue rider: 1d6, not 3d6.
    const hit = await longswordHit({ level: 1, fighterLevel: 5, rolls: [HIT, 3, 0] })
    expect(outcomeDice(hit).hit).toEqual(['d8', 'd6'])
    expect(damage(hit).map((part) => part.requested)).toEqual([4 + 3, 1])
  })

  it('doubles the rider’s dice on a critical hit, but not the weapon’s modifier', async () => {
    // Rogue 5: the critical rolls 2d8 + 3 and 6d6.
    const critical = await longswordHit({
      level: 5,
      rolls: [NATURAL_20, 3, 6, 0, 1, 2, 3, 4, 5]
    })
    expect(critical.d20).toMatchObject({ resultPath: 'ON_CRIT' })
    expect(outcomeDice(critical).hit).toEqual(['d8', 'd8', 'd6', 'd6', 'd6', 'd6', 'd6', 'd6'])
    expect(damage(critical).map((part) => part.requested)).toEqual([
      4 + 7 + 3,
      1 + 2 + 3 + 4 + 5 + 6
    ])
  })

  it('resists the rider like the weapon’s own damage', async () => {
    const hit = await longswordHit({
      level: 5,
      rolls: [HIT, 3, 0, 1, 2],
      resistantTo: SLASHING
    })
    expect(damage(hit)).toEqual([
      { requested: 7, resolved: 3, damageTypeId: SLASHING },
      { requested: 6, resolved: 3, damageTypeId: SLASHING }
    ])
  })

  it('leaves the weapon’s damage alone when no Feature carries a rider', () => {
    const plain = rogue({ level: 5, withRider: false })
    const { decision } = itemAction(plain, 'Longsword', { attackKind: 'MELEE', grip: 'ONE_HANDED' })
    expect(decision.mechanic.outcomes.filter((outcome) => outcome.kind === 'DAMAGE')).toHaveLength(
      1
    )
  })

  it('keeps the SRD Rogue’s shipped Sneak Attack inert until its conditions exist', () => {
    const sneaky = evaluateSrdCharacter({
      abilities: { STRENGTH: 16 },
      classes: [{ label: 'Rogue', level: 5 }],
      items: [{ label: 'Longsword', equipped: true }],
      features: [
        srdFeature({ owner: 'CLASS', classLabel: 'Rogue', featureLabel: 'Sneak Attack', level: 1 })
      ]
    })
    const { decision } = itemAction(sneaky, 'Longsword', {
      attackKind: 'MELEE',
      grip: 'ONE_HANDED'
    })
    expect(decision.mechanic.outcomes.filter((outcome) => outcome.kind === 'DAMAGE')).toHaveLength(
      1
    )
  })
})

describe('Life Domain Divine Strike rides on a weapon hit as authored ON_HIT data (SPELLS-31.T3a)', () => {
  const RADIANT = srdDamageTypeId('RADIANT')
  const riders = (level: number, weapon: 'Longsword' | 'Shortbow') => {
    const cleric = evaluateSrdCharacter({
      abilities: { STRENGTH: 16, DEXTERITY: 16 },
      classes: [{ label: 'Cleric', level, subclass: 'Life Domain' }],
      items: [{ label: weapon, equipped: true }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Cleric',
          subclassLabel: 'Life Domain',
          featureLabel: 'Divine Strike',
          level: 8
        })
      ]
    })
    const { decision } = itemAction(
      cleric,
      weapon,
      weapon === 'Longsword'
        ? { attackKind: 'MELEE', grip: 'ONE_HANDED' }
        : { attackKind: 'RANGED', grip: 'TWO_HANDED' }
    )
    return decision.mechanic.outcomes.flatMap((outcome) =>
      outcome.kind === 'DAMAGE' && outcome.damageTypeId === RADIANT ? [outcome.expression] : []
    )
  }

  it('adds 1d8 radiant at 8th level and 2d8 at 14th, on melee and ranged weapon hits', () => {
    expect(riders(8, 'Longsword')).toEqual(['1d8'])
    expect(riders(13, 'Longsword')).toEqual(['1d8'])
    expect(riders(14, 'Longsword')).toEqual(['2d8'])
    expect(riders(8, 'Shortbow')).toEqual(['1d8'])
    expect(riders(14, 'Shortbow')).toEqual(['2d8'])
  })
})

describe('a rider gated on the attack roll mode (D119)', () => {
  const advantageOnly = riderGate([{ predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'ADVANTAGE' }])
  const notDisadvantaged = riderGate([
    { predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'NOT_DISADVANTAGE' }
  ])

  it('applies a rider gated on advantage only to an attack with advantage', async () => {
    const advantaged = await longswordHit({
      level: 1,
      gate: advantageOnly,
      influence: 'ADVANTAGE',
      rolls: [HIT, 0, 3, 0]
    })
    expect(outcomeDice(advantaged).hit).toEqual(['d8', 'd6'])
    const level = await longswordHit({ level: 1, gate: advantageOnly, rolls: [HIT, 3] })
    expect(outcomeDice(level).hit).toEqual(['d8'])
  })

  it('does not apply an advantage-gated rider to a disadvantaged attack', async () => {
    const disadvantaged = await longswordHit({
      level: 1,
      gate: advantageOnly,
      influence: 'DISADVANTAGE',
      rolls: [HIT, HIT, 3]
    })
    expect(outcomeDice(disadvantaged).hit).toEqual(['d8'])
  })

  it('applies a rider gated on no disadvantage to a normal or advantaged attack only', async () => {
    const normal = await longswordHit({ level: 1, gate: notDisadvantaged, rolls: [HIT, 3, 0] })
    expect(outcomeDice(normal).hit).toEqual(['d8', 'd6'])
    const advantaged = await longswordHit({
      level: 1,
      gate: notDisadvantaged,
      influence: 'ADVANTAGE',
      rolls: [HIT, 0, 3, 0]
    })
    expect(outcomeDice(advantaged).hit).toEqual(['d8', 'd6'])
    const disadvantaged = await longswordHit({
      level: 1,
      gate: notDisadvantaged,
      influence: 'DISADVANTAGE',
      rolls: [HIT, HIT, 3]
    })
    expect(outcomeDice(disadvantaged).hit).toEqual(['d8'])
  })

  it('composes any-of through the gate groups and weapon checks through its conditions', async () => {
    // Advantage, or a finesse weapon: either group alone owes the rider.
    const anyOf = riderGate(
      [{ predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'ADVANTAGE' }],
      [{ predicateCode: 'EQUIPMENT_PROPERTY', properties: ['FINESSE'] }]
    )
    const longsword = await longswordHit({ level: 1, gate: anyOf, rolls: [HIT, 3] })
    expect(outcomeDice(longsword).hit).toEqual(['d8'])
    const advantaged = await longswordHit({
      level: 1,
      gate: anyOf,
      influence: 'ADVANTAGE',
      rolls: [HIT, 0, 3, 0]
    })
    expect(outcomeDice(advantaged).hit).toEqual(['d8', 'd6'])
    const rapier = await longswordHit({
      level: 1,
      gate: anyOf,
      weapon: 'Rapier',
      rolls: [HIT, 3, 0]
    })
    expect(outcomeDice(rapier).hit).toEqual(['d8', 'd6'])
  })

  it('requires every check of one group', async () => {
    // A finesse weapon and advantage: the Rapier without advantage owes nothing.
    const both = riderGate([
      { predicateCode: 'EQUIPMENT_PROPERTY', properties: ['FINESSE'] },
      { predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'ADVANTAGE' }
    ])
    const plain = await longswordHit({ level: 1, gate: both, weapon: 'Rapier', rolls: [HIT, 3] })
    expect(outcomeDice(plain).hit).toEqual(['d8'])
    const advantaged = await longswordHit({
      level: 1,
      gate: both,
      weapon: 'Rapier',
      influence: 'ADVANTAGE',
      rolls: [HIT, 0, 3, 0]
    })
    expect(outcomeDice(advantaged).hit).toEqual(['d8', 'd6'])
    const longsword = await longswordHit({
      level: 1,
      gate: both,
      influence: 'ADVANTAGE',
      rolls: [HIT, 0, 3]
    })
    expect(outcomeDice(longsword).hit).toEqual(['d8'])
  })
})

describe('a rider gated on an enemy near the target (D119)', () => {
  // Sneak Attack's two ways in: advantage, or an able enemy within 5 ft and no disadvantage.
  const sneakGate = riderGate(
    [{ predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'ADVANTAGE' }],
    [
      { predicateCode: 'ENEMY_NEAR_TARGET', feet: 5 },
      { predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'NOT_DISADVANTAGE' }
    ]
  )

  it('applies the rider to a level attack with an able enemy within the distance', async () => {
    const hit = await longswordHit({
      level: 1,
      gate: sneakGate,
      enemyProximity: { nearestFeet: 5 },
      rolls: [HIT, 3, 0]
    })
    expect(outcomeDice(hit).hit).toEqual(['d8', 'd6'])
  })

  it('withholds the rider when the nearest able enemy is too far or there is none', async () => {
    for (const enemyProximity of [{ nearestFeet: 10 }, { nearestFeet: null }]) {
      const hit = await longswordHit({ level: 1, gate: sneakGate, enemyProximity, rolls: [HIT, 3] })
      expect(outcomeDice(hit).hit).toEqual(['d8'])
    }
  })

  it('withholds the rider from an attack without a Scene to measure on', async () => {
    const hit = await longswordHit({ level: 1, gate: sneakGate, rolls: [HIT, 3] })
    expect(outcomeDice(hit).hit).toEqual(['d8'])
  })

  it('withholds the rider from a disadvantaged attack beside an enemy', async () => {
    const hit = await longswordHit({
      level: 1,
      gate: sneakGate,
      enemyProximity: { nearestFeet: 5 },
      influence: 'DISADVANTAGE',
      rolls: [HIT, HIT, 3]
    })
    expect(outcomeDice(hit).hit).toEqual(['d8'])
  })

  it('still applies the rider to an advantaged attack with no enemy near', async () => {
    const hit = await longswordHit({
      level: 1,
      gate: sneakGate,
      enemyProximity: { nearestFeet: null },
      influence: 'ADVANTAGE',
      rolls: [HIT, 0, 3, 0]
    })
    expect(outcomeDice(hit).hit).toEqual(['d8', 'd6'])
  })
})
