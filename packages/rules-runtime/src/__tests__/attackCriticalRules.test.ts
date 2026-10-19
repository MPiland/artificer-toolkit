import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { dnd5eCharacterActionCapabilityAdapter } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { evaluateSrdCharacter, itemAction } from '../testing/dnd5eSrdCharacter.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { outcomeDice } from './encounterCreatureAction.js'

const TARGET_ID = testUuid(0xd2)

/** A Fighter's Longsword attack (1d8 + 3) against a target of the given AC; rolls are 0-based faces. */
async function longswordAttack(input: {
  armorClass: number
  rolls: number[]
  attackCriticalRules?: { threshold: number; extraDice: number }
}) {
  const character = evaluateSrdCharacter({
    abilities: { STRENGTH: 16 },
    classes: [{ label: 'Fighter', level: 1 }],
    items: [{ label: 'Longsword', equipped: true }]
  })
  const { candidate, decision } = itemAction(character, 'Longsword', {
    attackKind: 'MELEE',
    grip: 'ONE_HANDED'
  })
  const action = dnd5eCharacterActionCapabilityAdapter.discover({
    candidates: character.facts.actionCandidates,
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    entryPoints: character.entryPoints
  })[character.facts.actionCandidates.indexOf(candidate)]
  if (!action) throw new Error('The Longsword action was not discovered.')
  const plan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
  if (!plan) throw new Error('The Longsword action has no execution plan.')
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
    occurrenceId: testUuid(0xd3),
    binding: {
      actionMechanic: { ...decision.mechanic, save: null },
      sourceDerivedFacts: input.attackCriticalRules
        ? { attackCriticalRules: input.attackCriticalRules }
        : {},
      targetActorId: TARGET_ID,
      targetDerivedFacts: { statBlock: { armorClass: input.armorClass } },
      targetConditionIds: [],
      currentHitPoints: 59,
      temporaryHitPoints: 0,
      maximumHitPoints: 59,
      targetScalarValues: {},
      defenses: []
    },
    afterTest: async () => undefined,
    random: (maxExclusive) => {
      const value = rolls.shift()
      if (value === undefined || value >= maxExclusive)
        throw new Error(`Unexpected random call (max ${maxExclusive}).`)
      return value
    }
  })
  return { execution, unusedRolls: rolls }
}

describe('attack critical rules (D158)', () => {
  it('crits on a natural 19 with a threshold of 19, whatever the target’s AC', async () => {
    const { execution } = await longswordAttack({
      armorClass: 30,
      rolls: [18, 3, 6],
      attackCriticalRules: { threshold: 19, extraDice: 0 }
    })
    expect(execution.d20).toMatchObject({ selectedNatural: 19, resultPath: 'ON_CRIT' })
    expect(outcomeDice(execution).hit).toEqual(['d8', 'd8'])
  })

  it('misses a natural 19 against an AC it does not reach without a lowered threshold', async () => {
    const { execution, unusedRolls } = await longswordAttack({ armorClass: 30, rolls: [18] })
    expect(execution.d20).toMatchObject({ selectedNatural: 19, resultPath: 'ON_MISS' })
    expect(unusedRolls).toEqual([])
  })

  it('crits on a natural 18 with a threshold of 18, and not on a 17', async () => {
    const rules = { threshold: 18, extraDice: 0 }
    const crit = await longswordAttack({
      armorClass: 11,
      rolls: [17, 3, 6],
      attackCriticalRules: rules
    })
    expect(crit.execution.d20).toMatchObject({ resultPath: 'ON_CRIT' })
    const hit = await longswordAttack({
      armorClass: 11,
      rolls: [16, 3],
      attackCriticalRules: rules
    })
    expect(hit.execution.d20).toMatchObject({ resultPath: 'ON_HIT' })
  })

  it('always misses on a natural 1, even with a lowered threshold', async () => {
    const { execution } = await longswordAttack({
      armorClass: 1,
      rolls: [0],
      attackCriticalRules: { threshold: 2, extraDice: 0 }
    })
    expect(execution.d20).toMatchObject({ selectedNatural: 1, resultPath: 'ON_MISS' })
  })

  it('rolls the extra critical dice of the attack’s own damage die, and none on a normal hit', async () => {
    const rules = { threshold: 20, extraDice: 2 }
    const crit = await longswordAttack({
      armorClass: 11,
      rolls: [19, 0, 1, 2, 3],
      attackCriticalRules: rules
    })
    expect(outcomeDice(crit.execution).hit).toEqual(['d8', 'd8', 'd8', 'd8'])
    expect(crit.unusedRolls).toEqual([])
    const hit = await longswordAttack({
      armorClass: 11,
      rolls: [12, 4],
      attackCriticalRules: rules
    })
    expect(outcomeDice(hit.execution).hit).toEqual(['d8'])
  })
})
