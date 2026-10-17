import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { dnd5eCharacterActionCapabilityAdapter } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { SRD, evaluateSrdCharacter, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  outcomeDice,
  prepareCreatureAction,
  settleCreatureAction,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const TARGET_ID = testUuid(0xd2)

function scriptedRolls(rolls: number[]) {
  return (maxExclusive: number) => {
    const value = rolls.shift()
    if (value === undefined || value >= maxExclusive)
      throw new Error(`Unexpected random call (max ${maxExclusive}).`)
    return value
  }
}

/** An SRD Character's Potion of Healing, drunk through the real discovery, policy and kernel. */
function potionOfHealing() {
  const character = evaluateSrdCharacter({
    classes: [{ label: 'Fighter', level: 1 }],
    items: [{ label: 'Potion of Healing' }]
  })
  const itemInstanceId = character.itemInstanceId('Potion of Healing')
  const index = character.facts.actionCandidates.findIndex(
    (candidate) => candidate.equipment?.itemInstanceId === itemInstanceId
  )
  const candidate = character.facts.actionCandidates[index]
  const decision = character.output.actionDecisions.find(
    (entry) => entry.actionId === candidate?.actionId
  )
  const action = dnd5eCharacterActionCapabilityAdapter.discover({
    candidates: character.facts.actionCandidates,
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    entryPoints: character.entryPoints
  })[index]
  if (!decision || !action) throw new Error('The Potion of Healing action was not discovered.')
  return { action, mechanic: decision.mechanic }
}

async function drink(input: {
  potion: ReturnType<typeof potionOfHealing>
  expression?: string
  rolls: number[]
}) {
  const { action, mechanic } = input.potion
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
    plan: {
      kind: 'SINGLE_GRAPH',
      published: dnd5eCharacterRuleActionSystemAdapter.compile({ action })
    },
    occurrenceId: testUuid(0xd3),
    binding: {
      actionMechanic: {
        ...mechanic,
        save: null,
        outcomes: mechanic.outcomes.map((outcome) =>
          outcome.kind === 'HEAL' && input.expression !== undefined
            ? { ...outcome, expression: input.expression }
            : outcome
        )
      },
      sourceDerivedFacts: {},
      targetActorId: TARGET_ID,
      targetDerivedFacts: {},
      targetConditionIds: [],
      currentHitPoints: 1,
      temporaryHitPoints: 0,
      maximumHitPoints: 30,
      targetScalarValues: {},
      defenses: []
    },
    afterTest: async () => undefined,
    random: scriptedRolls(rolls)
  })
  expect(rolls).toEqual([])
  return execution
}

function healDice(execution: Awaited<ReturnType<typeof executeNativeActionGraphs>>) {
  return execution.execution.evidence.trace.flatMap((entry) =>
    entry.operation.key === 'evidence.integer-range' ? [`d${String(entry.inputs.max)}`] : []
  )
}

describe('mixed dice-plus-modifier healing keeps its roll identity through the kernel', () => {
  it('rolls the authored 2d4 of a Potion of Healing and adds its +2 once', async () => {
    const potion = potionOfHealing()
    expect(potion.mechanic.outcomes).toMatchObject([{ kind: 'HEAL', expression: '2d4+2' }])

    const execution = await drink({ potion, rolls: [0, 3] })
    expect(healDice(execution)).toEqual(['d4', 'd4'])
    expect(execution.applications).toMatchObject([
      { kind: 'HEAL', targetActorId: TARGET_ID, appliedAmount: 1 + 4 + 2 }
    ])
  })

  it('takes the modifier from the resolved expression but keeps the authored dice', async () => {
    const execution = await drink({ potion: potionOfHealing(), expression: '2d4+5', rolls: [1, 1] })
    expect(healDice(execution)).toEqual(['d4', 'd4'])
    expect(execution.applications).toMatchObject([{ kind: 'HEAL', appliedAmount: 2 + 2 + 5 }])
  })

  it.each(['1d4+2', '3d4+2', '2d6+2'])(
    'refuses a resolved %s that changes the authored 2d4',
    async (expression) => {
      await expect(drink({ potion: potionOfHealing(), expression, rolls: [] })).rejects.toThrow(
        'D&D resolved healing expression does not match the authored dice.'
      )
    }
  )
})

/** The seeded Adult Red Dragon's Bite against the seeded Ogre (AC 11). */
async function prepareBite() {
  const dragon = srdByLabel(SRD.creatures, 'Adult Red Dragon')
  return prepareCreatureAction({
    actor: srdCreatureActor({ id: testUuid(0xd1), creature: dragon }),
    target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    featureId: creatureFeature(dragon, 'Bite').id,
    overridable: true
  })
}

function damageParts(execution: Awaited<ReturnType<typeof executeNativeActionGraphs>>) {
  return execution.applications.flatMap((application) =>
    application.kind === 'DAMAGE'
      ? [
          {
            sourceNodeId: application.sourceNodeId,
            amount: application.requestedAmount,
            damageTypeId: application.damageTypeId
          }
        ]
      : []
  )
}

type BindingOutcome = Readonly<Record<string, unknown>>

/** The Bite's binding with each of its two damage outcomes rewritten; other outcomes are kept. */
function rebindBiteDamage(
  prepared: Awaited<ReturnType<typeof prepareBite>>,
  rewrite: (outcome: BindingOutcome, damage: readonly BindingOutcome[]) => BindingOutcome
) {
  const { actionMechanic } = prepared.binding
  const outcomes: readonly unknown[] = Array.isArray(actionMechanic.outcomes)
    ? actionMechanic.outcomes
    : []
  const isDamage = (outcome: unknown): outcome is BindingOutcome =>
    typeof outcome === 'object' &&
    outcome !== null &&
    'kind' in outcome &&
    outcome.kind === 'DAMAGE'
  const damage = outcomes.filter(isDamage)
  expect(damage).toHaveLength(2)
  return {
    ...prepared.binding,
    actionMechanic: {
      ...actionMechanic,
      outcomes: outcomes.map((outcome) => (isDamage(outcome) ? rewrite(outcome, damage) : outcome))
    }
  }
}

describe('multiple damage parts on one path keep their identity through the kernel', () => {
  it('rolls, totals and types each part of a hit separately', async () => {
    // Adult Red Dragon Bite: 2d10 + 8 piercing plus 2d6 fire, both on the hit path.
    const prepared = await prepareBite()
    const { execution } = await settleCreatureAction({ prepared, rolls: [10, 0, 1, 2, 3] })

    expect(execution.d20).toMatchObject({ resultPath: 'ON_HIT' })
    expect(outcomeDice(execution).hit).toEqual(['d10', 'd10', 'd6', 'd6'])
    const parts = damageParts(execution)
    expect(parts.map(({ amount, damageTypeId }) => [amount, damageTypeId])).toEqual([
      [1 + 2 + 8, srdDamageTypeId('PIERCING')],
      [3 + 4, srdDamageTypeId('FIRE')]
    ])
    expect(new Set(parts.map(({ sourceNodeId }) => sourceNodeId)).size).toBe(2)
  })

  it('refuses a resolved expression bound to the other part’s outcome', async () => {
    const prepared = await prepareBite()
    // The fire part's 2d6 bound to the piercing part's identity.
    const binding = rebindBiteDamage(prepared, (outcome, [piercing]) =>
      outcome === piercing ? { ...outcome, diceExpression: '2d6' } : outcome
    )
    await expect(settleCreatureAction({ prepared, rolls: [10], binding })).rejects.toThrow(
      'D&D resolved damage expression does not match the authored dice.'
    )
  })

  it('refuses two damage parts that claim one outcome identity', async () => {
    const prepared = await prepareBite()
    const binding = rebindBiteDamage(prepared, (outcome, [piercing]) => ({
      ...outcome,
      outcomeId: piercing!.outcomeId
    }))
    await expect(settleCreatureAction({ prepared, rolls: [10], binding })).rejects.toThrow(
      'D&D action has duplicate resolved damage outcome identities.'
    )
  })
})
