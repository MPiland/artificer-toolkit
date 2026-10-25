import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { adultBlackDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-black-dragon.js'
import { evasionGrant } from '@artificer-toolkit/source-data/srd/classes/mechanics.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { characterMechanicsApplicationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SpatialSceneToken } from '@artificer-toolkit/shared/vtt'

import { DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS } from '../systems/dnd5e/effectActionContracts.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { nativeConcentrationDamageApplications } from '../encounterConcentrationDamage.js'
import {
  answerEncounterAreaTest,
  absentEncounterActorIds,
  catchEncounterAreaActorIds,
  prepareEncounterAreaTests,
  settleEncounterAreaAction,
  type EncounterAreaTarget,
  type EncounterAreaTargetTest
} from '../encounterAreaActionExecution.js'
import {
  decideEncounterAreaLegendaryResistance,
  encounterAreaLegendaryResistanceAudits,
  encounterTargetLegendaryResistance,
  offerEncounterAreaLegendaryResistance
} from '../encounterAreaLegendaryResistance.js'
import { encounterChosenActorEntries } from '../encounterAreaPending.js'
import { findEncounterFeatureResource } from '../encounterActorRuleOutput.js'
import { decideEncounterLegendaryResistance } from '../encounterLegendaryResistanceChoice.js'
import { discoverEncounterLegendaryResistanceCandidate } from '../encounterLegendaryResistanceDiscovery.js'
import { srdActorRules, srdDefinitions } from '../testing/dnd5eSrdEncounter.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  creatureActor,
  prepareCreatureAction,
  type CreatureFeature,
  srdAbilityId,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const FEATURE_ID = '00000000-0000-4000-8000-0000000f0003'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000f0001'
const CASTER_ID = '00000000-0000-4000-8000-0000000f1001'
const ALLY_ID = '00000000-0000-4000-8000-0000000f1002'
const FOE_ID = '00000000-0000-4000-8000-0000000f1003'
const WARDED_FOE_ID = '00000000-0000-4000-8000-0000000f1004'
const ACID = srdDamageTypeId('ACID')
const FIRE = srdDamageTypeId('FIRE')

/**
 * An SRD save spell as the Creature Feature a monster would carry. Two things differ from the
 * authored spell, both because a Creature Feature has no spellcaster behind it: a fixed DC of 13 in
 * place of SOURCE_SAVE_DC, and the damage taken at the spell's base cast level from the authored row,
 * since a Creature Feature has no cast level to scale by. The area, range, save, damage and half on a
 * success are the SRD data.
 */
function srdSaveSpell(label: string, baseLevel: number): CreatureFeature {
  const effect = srdSpells.find((spell) => spell.label === label)?.effects?.[0]
  if (effect?.invocation.triggerCode !== 'SAVING_THROW')
    throw new Error(`SRD ${label} is not a saving-throw action.`)
  const { invocation } = effect
  return {
    id: FEATURE_ID,
    label,
    description: `SRD ${label} as a Creature Feature.`,
    order: 1,
    effects: [
      {
        ...effect,
        invocation: {
          ...invocation,
          savingThrow: { ...invocation.savingThrow, dcMethod: 'FIXED_DC' as const, baseDc: 13 }
        },
        paths: effect.paths.map((path) => {
          if (!('resultBlock' in path) || path.resultBlock.resultKind !== 'SINGLE')
            throw new Error(`SRD ${label} paths are single results.`)
          return {
            ...path,
            resultBlock: {
              ...path.resultBlock,
              outcomes: path.resultBlock.outcomes.map((outcome) => {
                if (outcome.effectKind !== 'DAMAGE' || !('levels' in outcome)) return outcome
                const { levels, scalingSource, ...rest } = outcome
                void scalingSource
                const row = levels.find((level) => level.level === baseLevel)
                if (!row || !('diceConfig' in row))
                  throw new Error(`SRD ${label} has no base-level dice row.`)
                return {
                  ...rest,
                  valueKind: 'DICE' as const,
                  scalingKind: 'NONE' as const,
                  diceConfig: row.diceConfig
                }
              })
            }
          }
        })
      }
    ]
  }
}

/** Eight d6 faces (0-based) that total 27: 4 + 5 + 1 + 2 + 6 + 3 + 4 + 2. */
const EIGHT_D6 = [3, 4, 0, 1, 5, 2, 3, 1]

/**
 * "Acid Cloud": a DC 13 Dexterity save for 2d6 acid damage on a failure and, when `half` is
 * authored, half as much on a success. The compiler runs only single-target test actions, which is
 * the plan every caught creature executes, so the fixture is authored as one.
 */
function acidCloud(input: { half: boolean; successDice?: string }): CreatureFeature {
  const outcome = (id: string, diceConfig: string, multiplier?: number) => ({
    id,
    effectKind: EFFECT_KIND.DAMAGE,
    damageTypeId: ACID,
    scalingKind: 'NONE' as const,
    valueKind: 'DICE' as const,
    diceConfig,
    ...(multiplier === undefined ? {} : { multiplier })
  })
  const path = (
    index: number,
    pathCode: typeof PATH_CODE.ON_SAVE_FAIL | typeof PATH_CODE.ON_SAVE_SUCCESS,
    damage: ReturnType<typeof outcome>
  ) => {
    const id = `00000000-0000-4000-8000-0000000f01${index}0`
    return {
      id,
      order: index + 1,
      pathCode,
      groupType: PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE' as const,
      selectionKind: 'FIXED' as const,
      resultBlock: {
        id: `${id}__result`,
        resultKind: 'SINGLE' as const,
        outcomes: [{ ...damage, id }]
      }
    }
  }
  return {
    id: FEATURE_ID,
    label: 'Acid Cloud',
    description: 'Fixture: the per-creature plan of a save-for-half area action.',
    order: 1,
    effects: [
      {
        id: '00000000-0000-4000-8000-0000000f0004',
        order: 1,
        invocation: {
          kind: 'ACTION' as const,
          triggerCode: TRIGGER.SAVING_THROW,
          savingThrow: {
            id: '00000000-0000-4000-8000-0000000f0005',
            dcMethod: 'FIXED_DC' as const,
            abilityDefinitionId: srdAbilityId('DEXTERITY'),
            baseDc: 13
          },
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: '00000000-0000-4000-8000-0000000f0006', rangeKind: RANGE_KIND.UNLIMITED },
          targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
        },
        paths: [
          path(0, PATH_CODE.ON_SAVE_FAIL, outcome('fail', '2d6')),
          ...(input.half
            ? [
                path(
                  1,
                  PATH_CODE.ON_SAVE_SUCCESS,
                  outcome('success', input.successDice ?? '2d6', 0.5)
                )
              ]
            : [])
        ]
      }
    ]
  }
}

const runtime = createPlatformRulesRuntime({
  definitions: {
    async requireCurrent() {
      throw new Error('Definitions are not used by sealed graphs.')
    }
  }
})

/** The caster stands in its own area, beside an ally, a foe and a foe resistant to acid. */
function areaActors(feature: CreatureFeature, resisted: string) {
  const caster = creatureActor({
    id: CASTER_ID,
    label: 'Caster',
    features: [feature],
    disposition: 'FRIENDLY',
    damageResistanceIds: [resisted],
    hitPoints: 100
  })
  const ally = creatureActor({
    id: ALLY_ID,
    label: 'Ally',
    features: [],
    disposition: 'FRIENDLY',
    hitPoints: 100
  })
  const foe = creatureActor({ id: FOE_ID, label: 'Foe', features: [], hitPoints: 100 })
  const wardedFoe = creatureActor({
    id: WARDED_FOE_ID,
    label: 'Warded foe',
    features: [],
    damageResistanceIds: [resisted],
    hitPoints: 100
  })
  return { caster, ally, foe, wardedFoe }
}

/** A Wolf whose only feature is `feature`, its grants compiled into the Creature's rule facts. */
function featureHolder(id: string, feature: CreatureFeature, damageResistanceIds: string[] = []) {
  return creatureActor({
    id,
    label: feature.label,
    statBlock: { ...wolf, features: [feature] },
    features: [feature],
    damageResistanceIds,
    hitPoints: 100
  })
}

/** Every caught creature prepared through the real action preparation, each against its own facts. */
async function areaSource(
  caster: EncounterRunActorState,
  caught: readonly EncounterRunActorState[],
  discoverLegendaryResistance: (
    actor: EncounterRunActorState
  ) => EncounterAreaTarget['discoverLegendaryResistance'] = () => async () => null
) {
  const prepared = await Promise.all(
    caught.map((target) =>
      prepareCreatureAction({ actor: caster, target, featureId: FEATURE_ID, overridable: true })
    )
  )
  const [first] = prepared
  if (!first) throw new Error('The area needs a caught creature.')
  const entries = encounterChosenActorEntries(
    OCCURRENCE_ID,
    caught.map(({ id }) => id)
  )
  return {
    runtime,
    adapter: first.adapter,
    plan: first.plan,
    occurrenceId: OCCURRENCE_ID,
    targets: prepared.map((value, index) => ({
      actorId: caught[index]!.id,
      occurrenceId: entries[index]!.occurrenceId,
      binding: value.binding,
      // Each creature rolls its own save; the caster's dice are the app's.
      autoRoll: { SOURCE: true, TARGET: false },
      discoverLegendaryResistance: discoverLegendaryResistance(caught[index]!)
    }))
  }
}

type AreaSource = Awaited<ReturnType<typeof areaSource>>

function scriptedRandom(script: readonly number[]) {
  const queue = [...script]
  const maximums: number[] = []
  return {
    maximums,
    random: (maximum: number) => {
      const value = queue.shift()
      if (value === undefined || value < 0 || value >= maximum)
        throw new Error(`Unexpected random call (max ${maximum}).`)
      maximums.push(maximum)
      return value
    },
    remaining: () => queue.length
  }
}

function pendingOf(tests: readonly EncounterAreaTargetTest[], actorId: string) {
  const test = tests.find((entry) => entry.actorId === actorId)
  if (test?.kind !== 'PENDING') throw new Error(`${actorId} has no pending save.`)
  return test.pending
}

/** Each creature answers its own save with the natural die it rolled. */
async function answerSaves(
  source: AreaSource,
  naturals: Readonly<Record<string, number>>,
  order: readonly string[]
) {
  let tests = await prepareEncounterAreaTests(source)
  for (const actorId of order) {
    const target = source.targets.find((entry) => entry.actorId === actorId)!
    tests = await answerEncounterAreaTest({
      ...source,
      target,
      tests,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pendingOf(tests, actorId).continuation.request.requestId,
        rawFaces: [naturals[actorId]!],
        rollMode: 'NORMAL'
      }
    })
  }
  return tests
}

function applied(settled: Awaited<ReturnType<typeof settleEncounterAreaAction>>, actorId: string) {
  const target = settled.find((entry) => entry.actorId === actorId)
  if (!target) throw new Error(`${actorId} was not settled.`)
  return target.complete.applications.flatMap((application) =>
    application.kind === 'DAMAGE' ? [application.appliedAmount] : []
  )
}

/**
 * Each target's settled damage wrapped as the persisted mechanics DTO the Concentration planner
 * reads. The amounts come from the settlement; the receipt shell around them is fixture data.
 */
function damageBatches(
  settled: Awaited<ReturnType<typeof settleEncounterAreaAction>>,
  damageTypeId: string
) {
  return settled.map((entry) => ({
    targetActorId: entry.actorId,
    applications: entry.complete.applications.flatMap((application, ordinal) =>
      application.kind === 'DAMAGE'
        ? [
            characterMechanicsApplicationDtoSchema.parse({
              ordinal,
              kind: 'DAMAGE',
              requestedAmount: application.requestedAmount,
              resolvedAmount: application.resolvedAmount,
              appliedAmount: application.appliedAmount,
              beforeCurrentHitPoints: 40,
              afterCurrentHitPoints: 40 - application.appliedAmount,
              beforeTemporaryHitPoints: 0,
              afterTemporaryHitPoints: 0,
              maximumHitPoints: 40,
              damageTypeId,
              damageDisposition: 'NORMAL',
              incomingHalved: false,
              critical: false,
              sourceNodeId: application.sourceNodeId,
              sourceOperationKey: 'effect.damage',
              authoredPath: null,
              resolvedPath: null
            })
          ]
        : []
    )
  }))
}

function token(id: string, x: number): SpatialSceneToken {
  return { id, position: { x, y: 0 }, width: 2, height: 2 }
}

describe('catching the creatures in an area', () => {
  it('catches every actor with a token in the area, the caster and allies included, by token id', () => {
    const caught = catchEncounterAreaActorIds({
      origin: { x: 0, y: 0 },
      shape: { kind: 'RADIUS', radius: 20 },
      casterActorId: CASTER_ID,
      tokens: [
        { ...token('00000000-0000-4000-8000-0000000f2004', 100), actorId: FOE_ID },
        { ...token('00000000-0000-4000-8000-0000000f2003', 15), actorId: ALLY_ID },
        { ...token('00000000-0000-4000-8000-0000000f2002', 0), actorId: CASTER_ID },
        { ...token('00000000-0000-4000-8000-0000000f2001', -10), actorId: WARDED_FOE_ID }
      ]
    })
    expect(caught).toEqual([WARDED_FOE_ID, CASTER_ID, ALLY_ID])
  })

  it('catches an actor once however many tokens it has in the area', () => {
    expect(
      catchEncounterAreaActorIds({
        origin: { x: 0, y: 0 },
        shape: { kind: 'CUBE', edgeLength: 40 },
        casterActorId: CASTER_ID,
        tokens: [
          { ...token('00000000-0000-4000-8000-0000000f2001', 0), actorId: FOE_ID },
          { ...token('00000000-0000-4000-8000-0000000f2002', 5), actorId: FOE_ID }
        ]
      })
    ).toEqual([FOE_ID])
  })
})

describe('an actor out of play in an area (D178)', () => {
  const tokens = [
    { ...token('00000000-0000-4000-8000-0000000f2001', 0), actorId: CASTER_ID },
    { ...token('00000000-0000-4000-8000-0000000f2002', 4), actorId: ALLY_ID },
    { ...token('00000000-0000-4000-8000-0000000f2003', 8), actorId: FOE_ID }
  ]
  const area = { origin: { x: 0, y: 0 }, shape: { kind: 'RADIUS', radius: 20 } } as const

  it.each(['GM_REMOVED', 'DEPARTED', 'EFFECT', 'EFFECT_KEEPS_TURN'] as const)(
    'is caught by nothing when its absence is %s, though its token stays in the area',
    (absence) => {
      const absentActorIds = absentEncounterActorIds([
        { id: ALLY_ID, absence },
        { id: FOE_ID, absence: null }
      ])
      expect(
        catchEncounterAreaActorIds({ ...area, casterActorId: CASTER_ID, tokens, absentActorIds })
      ).toEqual([CASTER_ID, FOE_ID])
    }
  )

  it('is caught again once its absence ends', () => {
    const absentActorIds = absentEncounterActorIds([{ id: ALLY_ID, absence: null }])
    expect(
      catchEncounterAreaActorIds({ ...area, casterActorId: CASTER_ID, tokens, absentActorIds })
    ).toEqual([CASTER_ID, ALLY_ID, FOE_ID])
  })
})

describe('catching the creatures in a directed area', () => {
  it('never catches the caster whose space the area extends from, and catches the others once', () => {
    const tokens = [
      { ...token('00000000-0000-4000-8000-0000000f2001', 0), actorId: CASTER_ID },
      { ...token('00000000-0000-4000-8000-0000000f2002', 4), actorId: ALLY_ID },
      { ...token('00000000-0000-4000-8000-0000000f2003', 40), actorId: FOE_ID }
    ]
    const shape = {
      kind: 'CUBE_FROM_SIDE',
      edgeLength: 10,
      cellSize: 2,
      gridOrigin: { x: 0, y: 0 },
      toward: { x: 20, y: 0 }
    } as const
    expect(
      catchEncounterAreaActorIds({
        origin: { x: 1, y: 0 },
        shape,
        casterActorId: CASTER_ID,
        tokens
      })
    ).toEqual([ALLY_ID])
  })

  it('needs the caster’s token: a directed area without one is an invariant, not an empty catch', () => {
    const shape = { kind: 'CONE', length: 10, toward: { x: 20, y: 0 } } as const
    expect(() =>
      catchEncounterAreaActorIds({
        origin: { x: 1, y: 0 },
        shape,
        casterActorId: FOE_ID,
        tokens: [{ ...token('00000000-0000-4000-8000-0000000f2001', 0), actorId: CASTER_ID }]
      })
    ).toThrow('A directed area needs the caster’s token.')
  })
})

describe('catching the creatures in a radius centered on the caster', () => {
  const tokens = (xs: { foe: number; ally: number }) => [
    { ...token('00000000-0000-4000-8000-0000000f2001', 0), actorId: CASTER_ID },
    { ...token('00000000-0000-4000-8000-0000000f2002', xs.ally), actorId: ALLY_ID },
    { ...token('00000000-0000-4000-8000-0000000f2003', xs.foe), actorId: FOE_ID }
  ]
  const centered = (xs: { foe: number; ally: number }) =>
    catchEncounterAreaActorIds({
      origin: { x: 0, y: 0 },
      shape: { kind: 'RADIUS', radius: 10 },
      casterActorId: CASTER_ID,
      tokens: tokens(xs),
      fromCasterSpace: true
    })

  it('measures the radius from the edge of the caster’s space, never catching the caster', () => {
    // The caster’s space is x -1..1: a 2-wide token at x 11 (10..12) lies 9 away, one at 12 only touches 10.
    expect(centered({ foe: 12, ally: 11 })).toEqual([ALLY_ID])
  })

  it('catches the caster, and not the token the radius from the center only touches, as a point area', () => {
    expect(
      catchEncounterAreaActorIds({
        origin: { x: 0, y: 0 },
        shape: { kind: 'RADIUS', radius: 10 },
        casterActorId: CASTER_ID,
        tokens: tokens({ foe: 12, ally: 11 })
      })
    ).toEqual([CASTER_ID])
  })

  it('catches the creatures sharing the caster’s own space, never the caster (SPELLS-33.T6k2b)', () => {
    // The caster’s space is x -1..1: the ally at 1 overlaps it, the foe at 2 only touches it.
    expect(
      catchEncounterAreaActorIds({
        origin: { x: 0, y: 0 },
        shape: { kind: 'CUBE', edgeLength: 2 },
        casterActorId: CASTER_ID,
        tokens: tokens({ foe: 2, ally: 1 }),
        fromCasterSpace: true
      })
    ).toEqual([ALLY_ID])
  })

  it('needs the caster’s token: a centered area without one is an invariant, not an empty catch', () => {
    expect(() =>
      catchEncounterAreaActorIds({
        origin: { x: 0, y: 0 },
        shape: { kind: 'RADIUS', radius: 10 },
        casterActorId: WARDED_FOE_ID,
        tokens: tokens({ foe: 12, ally: 11 }),
        fromCasterSpace: true
      })
    ).toThrow('A caster-centered area needs the caster’s token.')
  })
})

describe('an area action executed as one occurrence', () => {
  it('asks each caught creature for its own save, to its own roller, without rolling damage', async () => {
    const { caster, ally, foe } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
    const source = await areaSource(caster, [caster, ally, foe])
    const dice = scriptedRandom([])
    const tests = await prepareEncounterAreaTests({ ...source, random: dice.random })

    expect(tests.map((test) => [test.actorId, test.kind])).toEqual([
      [CASTER_ID, 'PENDING'],
      [ALLY_ID, 'PENDING'],
      [FOE_ID, 'PENDING']
    ])
    for (const test of tests) {
      const pending = pendingOf(tests, test.actorId)
      expect(pending.roller).toBe('TARGET')
      expect(pending.continuation.request).toMatchObject({ min: 1, max: 20 })
    }
    expect(dice.maximums).toEqual([])
  })

  it('answers the saves in any order and keeps the others waiting', async () => {
    const { caster, ally, foe } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
    const source = await areaSource(caster, [caster, ally, foe])
    const pending = await prepareEncounterAreaTests(source)
    const afterFoe = await answerEncounterAreaTest({
      ...source,
      target: source.targets[2]!,
      tests: pending,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pendingOf(pending, FOE_ID).continuation.request.requestId,
        rawFaces: [10],
        rollMode: 'NORMAL'
      }
    })
    expect(afterFoe.map((test) => [test.actorId, test.kind])).toEqual([
      [CASTER_ID, 'PENDING'],
      [ALLY_ID, 'PENDING'],
      [FOE_ID, 'TESTED']
    ])

    const naturals = { [CASTER_ID]: 11, [ALLY_ID]: 10, [FOE_ID]: 10 }
    const forward = await answerSaves(source, naturals, [CASTER_ID, ALLY_ID, FOE_ID])
    const backward = await answerSaves(source, naturals, [FOE_ID, ALLY_ID, CASTER_ID])
    const settle = (tests: EncounterAreaTargetTest[]) =>
      settleEncounterAreaAction({
        ...source,
        tests,
        random: scriptedRandom(EIGHT_D6).random
      })
    const [settledForward, settledBackward] = await Promise.all([settle(forward), settle(backward)])
    for (const actorId of [CASTER_ID, ALLY_ID, FOE_ID])
      expect(applied(settledBackward, actorId)).toEqual(applied(settledForward, actorId))
  })

  it('does not settle while any caught creature has not answered its save', async () => {
    const { caster, ally, foe } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
    const source = await areaSource(caster, [caster, ally, foe])
    const pending = await prepareEncounterAreaTests(source)
    await expect(settleEncounterAreaAction({ ...source, tests: pending })).rejects.toThrow(
      'before the area settles'
    )
  })

  it('rolls damage once for the whole area; a failure takes it all and a success half, after each creature’s own resistance', async () => {
    const { caster, ally, foe, wardedFoe } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
    const source = await areaSource(caster, [caster, ally, foe, wardedFoe])
    // Natural 10 + DEX 2 = 12 fails DC 13; natural 11 = 13 succeeds.
    const tests = await answerSaves(
      source,
      { [CASTER_ID]: 11, [ALLY_ID]: 11, [FOE_ID]: 10, [WARDED_FOE_ID]: 10 },
      [CASTER_ID, ALLY_ID, FOE_ID, WARDED_FOE_ID]
    )
    // One 2d6 roll of 4 and 5, taken from the script exactly once.
    const dice = scriptedRandom(EIGHT_D6)
    const settled = await settleEncounterAreaAction({ ...source, tests, random: dice.random })

    expect(dice.maximums).toEqual(EIGHT_D6.map(() => 6))
    expect(dice.remaining()).toBe(0)
    // 8d6 rolled 27: the foe fails (27); the ally succeeds (13, rounded down); the warded foe fails
    // and resists fire (13); the caster succeeds (13) and resists fire (6).
    expect(applied(settled, FOE_ID)).toEqual([27])
    expect(applied(settled, ALLY_ID)).toEqual([13])
    expect(applied(settled, WARDED_FOE_ID)).toEqual([13])
    expect(applied(settled, CASTER_ID)).toEqual([6])
    expect(
      settled.flatMap((entry) =>
        entry.complete.applications.flatMap((a) => (a.kind === 'DAMAGE' ? [a.damageTypeId] : []))
      )
    ).toEqual([FIRE, FIRE, FIRE, FIRE])
    expect(
      settled.every((entry) => entry.complete.applications.every((a) => 'targetActorId' in a))
    ).toBe(true)
  })

  it('gives an Evasion holder no damage on a success and half on a failure, before its resistance (SPELLS-31.T5a)', async () => {
    const evasion: CreatureFeature = {
      id: '00000000-0000-4000-8000-0000000f0e01',
      label: 'Evasion',
      description: 'A Dexterity save for half deals nothing on a success and half on a failure.',
      order: 2,
      grants: { modifiers: [evasionGrant('00000000-0000-4000-8000-0000000f0e02')] }
    }
    const { caster } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
    const caught = [
      featureHolder(ALLY_ID, evasion),
      featureHolder(FOE_ID, evasion),
      featureHolder(WARDED_FOE_ID, evasion, [FIRE])
    ]
    const source = await areaSource(caster, caught)
    const tests = await answerSaves(source, { [ALLY_ID]: 11, [FOE_ID]: 10, [WARDED_FOE_ID]: 10 }, [
      ALLY_ID,
      FOE_ID,
      WARDED_FOE_ID
    ])
    const settled = await settleEncounterAreaAction({
      ...source,
      tests,
      random: scriptedRandom(EIGHT_D6).random
    })

    // 8d6 rolled 27: the success takes no damage at all, the failure half (13), and the resisting
    // failure half again (6).
    expect(applied(settled, ALLY_ID)).toEqual([])
    expect(applied(settled, FOE_ID)).toEqual([13])
    expect(applied(settled, WARDED_FOE_ID)).toEqual([6])
    // The bound multiplier is evidence: the fact and the node that read it, in each trace.
    const multipliers = Object.fromEntries(
      settled.map(({ actorId, complete }) => {
        const { facts, trace } = complete.execution.evidence
        const node = trace.find(({ nodeId }) => nodeId.endsWith('-save-multiplied'))
        return [actorId, { facts, multiplier: node?.inputs.multiplier }]
      })
    )
    expect(multipliers[ALLY_ID]).toMatchObject({
      facts: { [DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS.ON_SAVE_SUCCESS]: 0 },
      multiplier: 0
    })
    expect(multipliers[FOE_ID]).toMatchObject({
      facts: { [DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS.ON_SAVE_FAIL]: 0.5 },
      multiplier: 0.5
    })
  })

  it('leaves a save-for-half holder of another save ability its whole damage', async () => {
    const constitutionWard: CreatureFeature = {
      id: '00000000-0000-4000-8000-0000000f0e03',
      label: 'Stalwart Frame',
      description: 'A Constitution save for half deals nothing on a success.',
      order: 2,
      grants: {
        modifiers: [
          {
            ...evasionGrant('00000000-0000-4000-8000-0000000f0e04'),
            payload: {
              incomingDamageKind: 'SAVE_FOR_HALF',
              saveAbilities: ['CONSTITUTION'],
              onSaveSuccess: 'NONE',
              onSaveFailure: 'HALF'
            }
          }
        ]
      }
    }
    const { caster } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
    const source = await areaSource(caster, [
      featureHolder(ALLY_ID, constitutionWard),
      featureHolder(FOE_ID, constitutionWard)
    ])
    const tests = await answerSaves(source, { [ALLY_ID]: 11, [FOE_ID]: 10 }, [ALLY_ID, FOE_ID])
    const settled = await settleEncounterAreaAction({
      ...source,
      tests,
      random: scriptedRandom(EIGHT_D6).random
    })

    expect(applied(settled, ALLY_ID)).toEqual([13])
    expect(applied(settled, FOE_ID)).toEqual([27])
  })

  it('gives a creature that makes its Thunderwave save half the thunder damage (SPELLS-7.2)', async () => {
    const THUNDER = srdDamageTypeId('THUNDER')
    const { caster, ally, foe } = areaActors(srdSaveSpell('Thunderwave', 1), THUNDER)
    const source = await areaSource(caster, [ally, foe])
    // Natural 11 + CON 1 = 12 fails DC 13; natural 12 = 13 succeeds.
    const tests = await answerSaves(source, { [ALLY_ID]: 12, [FOE_ID]: 11 }, [ALLY_ID, FOE_ID])
    // One 2d8 roll of 7 and 3.
    const dice = scriptedRandom([6, 2])
    const settled = await settleEncounterAreaAction({ ...source, tests, random: dice.random })

    expect(dice.maximums).toEqual([8, 8])
    expect(dice.remaining()).toBe(0)
    expect(applied(settled, FOE_ID)).toEqual([10])
    expect(applied(settled, ALLY_ID)).toEqual([5])
    expect(
      settled.flatMap((entry) =>
        entry.complete.applications.flatMap((a) => (a.kind === 'DAMAGE' ? [a.damageTypeId] : []))
      )
    ).toEqual([THUNDER, THUNDER])
  })

  it('refuses a creature whose outcome would roll different dice than the frozen damage', async () => {
    const { caster, ally, foe } = areaActors(acidCloud({ half: true, successDice: '2d8' }), ACID)
    const source = await areaSource(caster, [caster, ally, foe])
    const tests = await answerSaves(source, { [CASTER_ID]: 10, [ALLY_ID]: 11, [FOE_ID]: 10 }, [
      CASTER_ID,
      ALLY_ID,
      FOE_ID
    ])
    await expect(
      settleEncounterAreaAction({ ...source, tests, random: scriptedRandom([3, 4, 5, 5]).random })
    ).rejects.toThrow('frozen area damage')
  })

  it('takes a Legendary Resistance success on one failed save without touching the others or the damage', async () => {
    const { caster, ally, foe } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
    const source = await areaSource(caster, [ally, foe])
    const tests = await answerSaves(source, { [ALLY_ID]: 10, [FOE_ID]: 10 }, [ALLY_ID, FOE_ID])
    const allyTest = tests.find((test) => test.actorId === ALLY_ID)
    if (allyTest?.kind !== 'TESTED') throw new Error('The ally save is unanswered.')
    const { boundary } = allyTest
    expect(boundary.execution.outputs.resultPath).toBe('ON_SAVE_FAIL')

    const dice = scriptedRandom(EIGHT_D6)
    const settled = await settleEncounterAreaAction({
      ...source,
      tests,
      random: dice.random,
      // The choice graph's own execution is the room's; here it only has to be a sealed execution.
      legendaryResistance: new Map([
        [
          ALLY_ID,
          {
            choiceExecution: boundary.execution,
            selection: 'USE' as const,
            originalExecutionChecksum: checksumRuleDocument(boundary.execution),
            targetStateChecksum: 'a'.repeat(64),
            resistance: {
              targetActorId: ALLY_ID,
              ownerFeatureId: 'legendary-resistance',
              chargeId: 'legendary-resistance-charge',
              featureCost: 1,
              poolBefore: 3,
              poolRemaining: 2,
              definitionId: '00000000-0000-4000-8000-0000000f3001',
              definitionVersion: 1,
              definitionChecksum: 'b'.repeat(64),
              choiceGraphDefinitionId: '00000000-0000-4000-8000-0000000f3002',
              choiceGraphDefinitionVersion: 1,
              choiceGraphDefinitionChecksum: 'c'.repeat(64),
              useOutput: 'use',
              useOptionId: 'd'.repeat(64),
              selectionChecksum: 'e'.repeat(64)
            },
            d20: boundary.d20Policy
          }
        ]
      ])
    })

    expect(applied(settled, ALLY_ID)).toEqual([13])
    expect(applied(settled, FOE_ID)).toEqual([27])
    expect(dice.maximums).toEqual(EIGHT_D6.map(() => 6))
  })

  it('refuses a Legendary Resistance decision sealed against another creature’s save', async () => {
    const { caster, ally, foe } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
    const source = await areaSource(caster, [ally, foe])
    const tests = await answerSaves(source, { [ALLY_ID]: 10, [FOE_ID]: 10 }, [ALLY_ID, FOE_ID])
    const foeTest = tests.find((test) => test.actorId === FOE_ID)
    if (foeTest?.kind !== 'TESTED') throw new Error('The foe save is unanswered.')
    const { boundary } = foeTest
    await expect(
      settleEncounterAreaAction({
        ...source,
        tests,
        random: scriptedRandom(EIGHT_D6).random,
        legendaryResistance: new Map([
          [
            ALLY_ID,
            {
              choiceExecution: boundary.execution,
              selection: 'USE' as const,
              originalExecutionChecksum: checksumRuleDocument(boundary.execution),
              targetStateChecksum: 'a'.repeat(64),
              resistance: {
                targetActorId: ALLY_ID,
                ownerFeatureId: 'legendary-resistance',
                chargeId: 'legendary-resistance-charge',
                featureCost: 1,
                poolBefore: 3,
                poolRemaining: 2,
                definitionId: '00000000-0000-4000-8000-0000000f3001',
                definitionVersion: 1,
                definitionChecksum: 'b'.repeat(64),
                choiceGraphDefinitionId: '00000000-0000-4000-8000-0000000f3002',
                choiceGraphDefinitionVersion: 1,
                choiceGraphDefinitionChecksum: 'c'.repeat(64),
                useOutput: 'use',
                useOptionId: 'd'.repeat(64),
                selectionChecksum: 'e'.repeat(64)
              },
              d20: boundary.d20Policy
            }
          ]
        ])
      })
    ).rejects.toThrow('Legendary Resistance outcome audit is stale')
  })

  it('yields one Concentration damage entry for each damaged creature', async () => {
    const { caster, ally, foe, wardedFoe } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
    const source = await areaSource(caster, [ally, foe, wardedFoe])
    const tests = await answerSaves(source, { [ALLY_ID]: 11, [FOE_ID]: 10, [WARDED_FOE_ID]: 10 }, [
      ALLY_ID,
      FOE_ID,
      WARDED_FOE_ID
    ])
    const settled = await settleEncounterAreaAction({
      ...source,
      tests,
      random: scriptedRandom(EIGHT_D6).random
    })
    const checks = nativeConcentrationDamageApplications(damageBatches(settled, FIRE))
    expect(
      checks.map(({ targetActorId, appliedAmount }) => [targetActorId, appliedAmount])
    ).toEqual([
      [ALLY_ID, 13],
      [FOE_ID, 27],
      [WARDED_FOE_ID, 13]
    ])
  })

  it('leaves a creature that took no damage out of the Concentration checks', async () => {
    const { caster, ally, foe } = areaActors(acidCloud({ half: false }), ACID)
    const source = await areaSource(caster, [ally, foe])
    const tests = await answerSaves(source, { [ALLY_ID]: 11, [FOE_ID]: 10 }, [ALLY_ID, FOE_ID])
    const settled = await settleEncounterAreaAction({
      ...source,
      tests,
      random: scriptedRandom([3, 4]).random
    })
    expect(applied(settled, ALLY_ID)).toEqual([])
    expect(
      nativeConcentrationDamageApplications(damageBatches(settled, ACID)).map(
        ({ targetActorId }) => targetActorId
      )
    ).toEqual([FOE_ID])
  })
})

const LEGENDARY_RESISTANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e4'
const DRAGON_ID = '00000000-0000-4000-8000-0000000f1005'
const NO_RESISTANCE = { kind: 'DECLINE' } as const

const legendaryResistanceFeature = (() => {
  const feature = adultBlackDragon.features?.find((entry) =>
    entry.ruleDefinitionIds?.includes(LEGENDARY_RESISTANCE_DEFINITION_ID)
  )
  if (!feature) throw new Error('SRD Legendary Resistance is missing.')
  return feature
})()

function dragonActor(used = 0) {
  return creatureActor({
    id: DRAGON_ID,
    label: 'Dragon',
    features: [legendaryResistanceFeature],
    hitPoints: 100,
    ...(used > 0 ? { featureChargesUsed: { [legendaryResistanceFeature.id]: used } } : {})
  })
}

/** Real discovery of the SRD Legendary Resistance on the given creature's current pool. */
function discoverFor(actors: readonly EncounterRunActorState[]) {
  const actorRules = srdActorRules(actors)
  return (actor: EncounterRunActorState) => () =>
    discoverEncounterLegendaryResistanceCandidate({
      encounter: { gameSystemId: SRD_SYSTEM_ID },
      targetActor: actor,
      actorRules,
      definitions: srdDefinitions
    })
}

function testedOf(tests: readonly EncounterAreaTargetTest[], actorId: string) {
  const test = tests.find((entry) => entry.actorId === actorId)
  if (test?.kind !== 'TESTED') throw new Error(`${actorId} has no answered save.`)
  return test
}

/** A dragon with three Legendary Resistance charges and a plain foe, both caught in Fireball. */
async function caughtDragonAndFoe(naturals: Readonly<Record<string, number>>) {
  const { caster, foe } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
  const dragon = dragonActor()
  const actors = [caster, dragon, foe]
  const source = await areaSource(caster, [dragon, foe], discoverFor(actors))
  const tests = await answerSaves(source, naturals, [DRAGON_ID, FOE_ID])
  const offer = offerEncounterAreaLegendaryResistance({
    test: testedOf(tests, DRAGON_ID),
    targetStateChecksum: 'a'.repeat(64)
  })
  const currentFeatureResource = findEncounterFeatureResource(
    srdActorRules(actors),
    DRAGON_ID,
    legendaryResistanceFeature.id
  )!
  return { source, tests, offer, currentFeatureResource, dragon }
}

async function decideDragon(
  area: Awaited<ReturnType<typeof caughtDragonAndFoe>>,
  selection: Parameters<typeof decideEncounterAreaLegendaryResistance>[0]['selection'],
  candidate = testedOf(area.tests, DRAGON_ID).legendaryResistance!
) {
  return decideEncounterAreaLegendaryResistance({
    runtime,
    areaOccurrenceId: OCCURRENCE_ID,
    test: testedOf(area.tests, DRAGON_ID),
    offer: area.offer!,
    candidate,
    targetStateChecksum: 'a'.repeat(64),
    selection,
    currentFeatureResource: area.currentFeatureResource
  })
}

describe('Legendary Resistance on an area save', () => {
  it('finds the creature’s Legendary Resistance after its failed save, and only then', async () => {
    const failed = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    expect(testedOf(failed.tests, DRAGON_ID).legendaryResistance).toMatchObject({
      targetActorId: DRAGON_ID,
      ownerFeatureId: legendaryResistanceFeature.id,
      poolBefore: 3,
      poolRemaining: 2
    })
    expect(testedOf(failed.tests, FOE_ID).legendaryResistance).toBeNull()

    const saved = await caughtDragonAndFoe({ [DRAGON_ID]: 11, [FOE_ID]: 10 })
    expect(testedOf(saved.tests, DRAGON_ID).legendaryResistance).toBeNull()
    expect(saved.offer).toBeNull()
  })

  it('finds it when the save is rolled for the creature as the area opens', async () => {
    const { caster, foe } = areaActors(srdSaveSpell('Fireball', 3), FIRE)
    const dragon = dragonActor()
    const source = await areaSource(caster, [dragon, foe], discoverFor([caster, dragon, foe]))
    const dice = scriptedRandom([9])
    const tests = await prepareEncounterAreaTests({
      ...source,
      random: dice.random,
      targets: source.targets.map((target) =>
        target.actorId === DRAGON_ID
          ? { ...target, autoRoll: { SOURCE: true, TARGET: true } }
          : target
      )
    })
    expect(testedOf(tests, DRAGON_ID).legendaryResistance).toMatchObject({
      targetActorId: DRAGON_ID
    })
    expect(tests.find((test) => test.actorId === FOE_ID)?.kind).toBe('PENDING')
  })

  it('turns the failed save into a success for the creature that uses it, and for it alone', async () => {
    const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    const used = await decideDragon(area, {
      kind: 'OPTION',
      optionId: area.offer!.resistance.useOptionId
    })
    expect(used.chargeProposal).toMatchObject({
      ownerActorId: DRAGON_ID,
      cost: 1,
      beforeRemaining: 3,
      afterRemaining: 2
    })
    const settled = await settleEncounterAreaAction({
      ...area.source,
      tests: area.tests,
      random: scriptedRandom(EIGHT_D6).random,
      legendaryResistance: encounterAreaLegendaryResistanceAudits(
        new Map([[DRAGON_ID, used.legendaryResistance]])
      )
    })
    expect(applied(settled, DRAGON_ID)).toEqual([13])
    expect(applied(settled, FOE_ID)).toEqual([27])
  })

  it('leaves the failure, and the full damage, when the creature declines', async () => {
    const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    const declined = await decideDragon(area, NO_RESISTANCE)
    expect(declined.chargeProposal).toBeNull()
    const settled = await settleEncounterAreaAction({
      ...area.source,
      tests: area.tests,
      random: scriptedRandom(EIGHT_D6).random,
      legendaryResistance: encounterAreaLegendaryResistanceAudits(
        new Map([[DRAGON_ID, declined.legendaryResistance]])
      )
    })
    expect(applied(settled, DRAGON_ID)).toEqual([27])
    expect(applied(settled, FOE_ID)).toEqual([27])
  })

  it.each([
    { name: 'uses', use: true },
    { name: 'declines', use: false }
  ])(
    'records on the creature’s own outcome what it $name and the charge only a use costs',
    async ({ use }) => {
      const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
      const decided = await decideDragon(
        area,
        use ? { kind: 'OPTION', optionId: area.offer!.resistance.useOptionId } : NO_RESISTANCE
      )
      const test = testedOf(area.tests, DRAGON_ID)
      const [audit] = [
        ...encounterAreaLegendaryResistanceAudits(
          new Map([[DRAGON_ID, decided.legendaryResistance]])
        ).values()
      ]
      const recorded = encounterTargetLegendaryResistance({
        audit: audit!,
        candidate: test.legendaryResistance!,
        boundary: test.boundary,
        currentFeatureResource: area.currentFeatureResource
      })
      expect(recorded.legendaryResistance).toMatchObject({
        use,
        originalExecution: test.boundary.execution,
        originalD20: test.boundary.d20
      })
      expect(recorded.charge).toEqual(use ? decided.chargeProposal : null)
    }
  )

  it('refuses to record a decision against a creature’s pool that has changed since', async () => {
    const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    const decided = await decideDragon(area, NO_RESISTANCE)
    const [audit] = [
      ...encounterAreaLegendaryResistanceAudits(
        new Map([[DRAGON_ID, decided.legendaryResistance]])
      ).values()
    ]
    const spent = dragonActor(1)
    const stale = await discoverFor([spent])(spent)()
    expect(() =>
      encounterTargetLegendaryResistance({
        audit: audit!,
        candidate: stale!,
        boundary: testedOf(area.tests, DRAGON_ID).boundary,
        currentFeatureResource: area.currentFeatureResource
      })
    ).toThrow('Legendary Resistance evidence is stale')
  })

  it('does not settle while a creature’s Legendary Resistance choice is undecided', async () => {
    const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    await expect(
      settleEncounterAreaAction({
        ...area.source,
        tests: area.tests,
        random: scriptedRandom(EIGHT_D6).random
      })
    ).rejects.toThrow('Legendary Resistance choice is undecided')
  })

  it('refuses a decision once the pool it was offered against has changed', async () => {
    const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    const spent = dragonActor(1)
    const stale = await discoverFor([spent])(spent)()
    expect(stale?.poolBefore).toBe(2)
    await expect(
      decideDragon(area, { kind: 'OPTION', optionId: area.offer!.resistance.useOptionId }, stale!)
    ).rejects.toThrow('Legendary Resistance evidence is stale')
  })

  it('refuses an option the offer never issued', async () => {
    const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    await expect(decideDragon(area, { kind: 'OPTION', optionId: 'f'.repeat(64) })).rejects.toThrow(
      'Legendary Resistance selection was not issued'
    )
  })
})

describe('the Legendary Resistance decision a single-target action shares with an area', () => {
  async function decideShared(
    area: Awaited<ReturnType<typeof caughtDragonAndFoe>>,
    overrides: Partial<Parameters<typeof decideEncounterLegendaryResistance>[0]> = {}
  ) {
    return decideEncounterLegendaryResistance({
      runtime,
      occurrenceId: OCCURRENCE_ID,
      boundary: testedOf(area.tests, DRAGON_ID).boundary,
      offer: area.offer!,
      candidate: testedOf(area.tests, DRAGON_ID).legendaryResistance!,
      targetStateChecksum: area.offer!.targetStateChecksum,
      selection: { kind: 'OPTION', optionId: area.offer!.resistance.useOptionId },
      currentFeatureResource: area.currentFeatureResource,
      ...overrides
    })
  }

  it('audits a use against the failed save, spending nothing itself', async () => {
    const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    const decided = await decideShared(area)
    expect(decided.audit.selection).toBe('USE')
    expect(decided.chargeProposal).toMatchObject({ ownerActorId: DRAGON_ID, cost: 1 })
  })

  it('refuses a creature whose pool changed since the offer', async () => {
    const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    const spent = dragonActor(1)
    const candidate = (await discoverFor([spent])(spent)())!
    await expect(decideShared(area, { candidate })).rejects.toThrow(
      'Legendary Resistance evidence is stale.'
    )
    const resource = { ...area.currentFeatureResource, used: 1, remaining: 2 }
    await expect(decideShared(area, { currentFeatureResource: resource })).rejects.toThrow(
      'Legendary Resistance charge is stale.'
    )
  })

  it('refuses a creature whose state changed since the offer', async () => {
    const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    await expect(decideShared(area, { targetStateChecksum: 'b'.repeat(64) })).rejects.toThrow(
      'Legendary Resistance evidence is stale.'
    )
  })

  it('refuses a candidate whose pin differs from the offer', async () => {
    const area = await caughtDragonAndFoe({ [DRAGON_ID]: 10, [FOE_ID]: 10 })
    const candidate = {
      ...testedOf(area.tests, DRAGON_ID).legendaryResistance!,
      ownerFeatureId: FEATURE_ID
    }
    await expect(decideShared(area, { candidate })).rejects.toThrow(
      'Legendary Resistance evidence is stale.'
    )
  })
})
