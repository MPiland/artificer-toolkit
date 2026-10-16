import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { prepareNativeCharacterActionState } from '../character/characterNativeActionResources.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscoveryRegistry.js'
import {
  buildCompiledActionCompilerSource,
  compileCharacterActionEntryPoints
} from '../encounterActionEntryPointCompiler.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  OPTIONAL_SMITE_EFFECT_ID,
  OPTIONAL_SMITE_FEATURE_ID,
  optionalSmite
} from '../testing/optionalSmite.js'
import { SRD, evaluateSrdCharacter, itemAction, srdByLabel } from './dnd5eSrdCharacter.js'
import { outcomeDice, srdDamageTypeId } from './encounterCreatureAction.js'

const TARGET_ID = testUuid(0xc2)
/** Ordinary and natural-20 d20 faces (0-based), against the target's Armor Class 11. */
const HIT = 14
const NATURAL_20 = 19
const FIGHTER = srdByLabel(SRD.classes, 'Fighter')
const RADIANT = srdDamageTypeId('RADIANT')
const SLASHING = srdDamageTypeId('SLASHING')

/** A Fighter wielding an equipped Longsword who carries the optional smite rider. */
function smiter() {
  return evaluateSrdCharacter({
    abilities: { STRENGTH: 16 },
    classes: [{ label: 'Fighter', level: 5 }],
    items: [{ label: 'Longsword', equipped: true }],
    extraFeatures: [optionalSmite()],
    features: [
      {
        acquisitionId: 'acquired:optional-smite',
        featureId: OPTIONAL_SMITE_FEATURE_ID,
        source: { kind: 'CLASS', classId: FIGHTER.id, classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL', classId: FIGHTER.id, classLevel: 1 }
      }
    ]
  })
}

/** The Longsword hit with the player's choice (the rider and the slot level paid), or none. */
async function longswordHit(input: {
  rolls: number[]
  smite?: { castLevel: number }
  resistantTo?: string
}) {
  const character = smiter()
  const { candidate, decision } = itemAction(character, 'Longsword', {
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
    overridable: false
  })
  const rolls = [...input.rolls]
  const execution = await executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(1),
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
      actionMechanic: input.smite
        ? {
            ...actionMechanic,
            spellCastLevel: input.smite.castLevel,
            selectedOptionalRiderIds: [OPTIONAL_SMITE_EFFECT_ID]
          }
        : actionMechanic,
      sourceDerivedFacts: {},
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
  return { execution, decision }
}

function damage(execution: Awaited<ReturnType<typeof longswordHit>>['execution']) {
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
    expect(outcomeDice(execution).hit).toEqual([
      'd8',
      ...Array.from({ length: count }, () => 'd8')
    ])
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
