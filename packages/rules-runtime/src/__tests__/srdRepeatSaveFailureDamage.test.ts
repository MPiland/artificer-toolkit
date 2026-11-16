import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { describe, expect, it } from 'vitest'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCondition } from '../testing/dnd5eSrdEncounter.js'

/**
 * QUALITY-15.T3z: a repeated save whose failure deals damage compiles through the repeat-save
 * effect: its graph rolls the failure's dice, at the cast level's row, only when the save fails, and
 * proposes them bound to the authored damage row.
 */

const FRIGHTENED = srdCondition('Frightened')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)

/** The repeat-save effect plan of the SRD spell's one Effect, cast by a 20th-level Character. */
function repeatSavePlan(label: string, castLevel?: number) {
  const spell = srdByLabel(SRD.spells, label)
  const [effect] = spell.effects ?? []
  if (!effect) throw new Error(`${label} has no Effect.`)
  const action = {
    ...characterActionDescriptor(
      compileSpellEffect(
        { attributes: spell.attributes ?? [], effects: [effect] },
        { ...effect, id: ACTION_EFFECT_ID }
      ),
      castLevel ?? spell.level,
      20
    ),
    conditionDefinitionIds
  }
  const plan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
  if (plan?.kind !== 'TEST_OUTCOME') throw new Error(`${label} compiled no test.`)
  const plans =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
      action,
      published: plan.test.published
    }) ?? []
  return { effect, plans }
}

/** The result block that holds the repeated save. */
function repeatBlock(effect: EffectAuthored) {
  const block = effect.paths
    .flatMap((path) => ('resultBlock' in path ? [path.resultBlock] : []))
    .find(({ outcomes }) => outcomes.some(({ effectKind }) => effectKind === 'FOLLOW_UP_SAVE'))
  if (!block) throw new Error('The Effect has no repeated save.')
  return block
}

/** The d10 dice the frozen graph asks for, each enabled only by the failed save. */
function failureDice(frozenGraph: ServerPublishedRuleDefinitionDto) {
  return frozenGraph.definition.nodes.filter(
    ({ operation, inputs }) =>
      operation.key === 'evidence.optional-integer-range' &&
      inputs.max?.kind === 'LITERAL' &&
      inputs.max.value === 10
  )
}

describe('a repeated save whose failure deals damage', () => {
  it.each([
    { label: 'Weird', dice: 4 },
    { label: 'Phantasmal Killer', dice: 4 }
  ])(
    '$label holds Frightened in a repeat-save effect whose failure rolls $dice d10',
    ({ label, dice }) => {
      const { effect, plans } = repeatSavePlan(label)
      const block = repeatBlock(effect)
      expect(block.id).toMatch(UUID)
      expect(plans).toHaveLength(1)
      const [plan] = plans
      expect(plan).toMatchObject({
        compiledEntryId: block.id,
        frozenGraphNodeId: 'repeat-save-test',
        recurrenceStage: 'END_OF_TURN',
        // "for 1 minute" is ten rounds.
        initialRemaining: 10,
        conditionContributions: [{ conditionId: FRIGHTENED }]
      })
      if (!plan) return
      expect(failureDice(plan.frozenGraph)).toHaveLength(dice)
      expect(
        plan.frozenGraph.definition.nodes.find(({ id }) => id === 'damage-enabled')?.inputs
      ).toMatchObject({
        resultPath: { kind: 'NODE_OUTPUT', nodeId: 'repeat-save-test', port: 'resultPath' },
        authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' }
      })
      // The proposal is bound to the authored damage row, beside the save bound to its block.
      expect(plan.frozenGraph.definition.sourceEntryBindings).toEqual([
        { sourceEntryId: block.id, nodeId: 'repeat-save-test' },
        { sourceEntryId: expect.stringMatching(UUID), nodeId: 'proposal-on_save_fail' }
      ])
    }
  )

  it.each([
    { castLevel: 4, dice: 4 },
    { castLevel: 5, dice: 5 },
    { castLevel: 9, dice: 9 }
  ])(
    'Phantasmal Killer cast at level $castLevel freezes $dice d10 into its effect',
    ({ castLevel, dice }) => {
      const { plans } = repeatSavePlan('Phantasmal Killer', castLevel)
      const [plan] = plans
      if (!plan) throw new Error('Phantasmal Killer holds no repeat-save effect.')
      expect(failureDice(plan.frozenGraph)).toHaveLength(dice)
    }
  )
})
