import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'

import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ATHLETICS_SKILL_ID,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { castChoiceOptions } from '../encounterCastChoice.js'
import {
  DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
  DND5E_STABILIZE_PROPOSAL_OPERATION_KEY
} from '../systems/dnd5e/effectActionContracts.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

const ATHLETICS_ID = SRD_ATHLETICS_SKILL_ID
const STRENGTH_ID = SRD_ABILITY_DEFINITION_IDS.STRENGTH
const SRD_BLUDGEONING_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'BLUDGEONING')!.id

/** Every operation key the compiled output names, wherever it nests. */
function operationKeys(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return []
  const own =
    'operation' in value &&
    typeof value.operation === 'object' &&
    value.operation !== null &&
    'key' in value.operation &&
    typeof value.operation.key === 'string'
      ? [value.operation.key]
      : []
  return [...own, ...Object.values(value).flatMap(operationKeys)]
}

function basicActionEffect(actionId: string): EffectAuthored {
  const effect = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === actionId)?.document.effects[0]
  if (!effect) throw new Error('The basic action has no authored effect.')
  return { ...effect, id: ACTION_EFFECT_ID }
}

function firstAidEffect(): EffectAuthored {
  return basicActionEffect(SRD_BASIC_ACTION_IDS.FIRST_AID)
}

function withCheck(check: unknown): EffectAuthored {
  const effect = firstAidEffect()
  return { ...effect, invocation: { ...effect.invocation, check } } as EffectAuthored
}

const CONTEST_DC = {
  kind: 'CONTEST',
  checks: { skillIds: [ATHLETICS_ID], abilityDefinitionIds: [] }
} as const

/** First Aid as an Athletics check against `dc` whose success settles `outcome` on its target. */
function checkWinning(outcome: Record<string, unknown>, dc: unknown = CONTEST_DC): EffectAuthored {
  const effect = withCheck({ checks: { skillIds: [ATHLETICS_ID], abilityDefinitionIds: [] }, dc })
  const [path] = effect.paths
  if (path?.selectionKind !== 'FIXED') throw new Error('First Aid has no fixed result path.')
  const [authored] = path.resultBlock.outcomes
  return {
    ...effect,
    paths: [
      {
        ...path,
        resultBlock: { ...path.resultBlock, outcomes: [{ id: authored!.id, ...outcome }] }
      }
    ]
  } as EffectAuthored
}

/** An action under the SRD System, whose condition vocabulary a relationship outcome names. */
function srdAction(effect: EffectAuthored) {
  return {
    ...characterActionDescriptor(compileEffect(effect)),
    conditionDefinitionIds: SRD_CONDITION_TYPES.map(({ id }) => id)
  }
}

function compile(effect: EffectAuthored) {
  return dnd5eCharacterRuleActionSystemAdapter.compile({ action: srdAction(effect) })
}

/** A check action's success, specialized from its compiled test and outcome plan (D173). */
function checkSuccess(effect: EffectAuthored) {
  const adapter = dnd5eCharacterRuleActionSystemAdapter
  const action = srdAction(effect)
  const compilerSource = buildCompiledActionCompilerSource(action)
  const compiled = adapter.compileExecutionPlan?.({ action, compilerSource })
  if (compiled?.kind !== 'TEST_OUTCOME') throw new Error('The check is not a test and its outcome.')
  expect(compiled.outcomes.map(({ pathCode }) => pathCode)).toEqual(['ON_CHECK_SUCCESS'])
  return adapter.specializeOutcomeTemplate?.({
    compilerSource,
    testTemplate: compiled.test,
    selectedPath: 'ON_CHECK_SUCCESS',
    facts: {},
    testRollMode: 'NORMAL'
  })?.published
}

describe('the CHECK action test compiles through the dnd5e adapter', () => {
  it('compiles First Aid, authored as a Medicine check against DC 10, to a check whose success is the stabilize proposal', () => {
    expect(operationKeys(checkSuccess(firstAidEffect()))).toContain(
      DND5E_STABILIZE_PROPOSAL_OPERATION_KEY
    )
  })

  it('compiles any authored single check, a skill or an ability, against a fixed DC', () => {
    for (const checks of [
      { skillIds: [ATHLETICS_ID], abilityDefinitionIds: [] },
      { skillIds: [], abilityDefinitionIds: [STRENGTH_ID] }
    ])
      expect(
        operationKeys(checkSuccess(withCheck({ checks, dc: { kind: 'FIXED', value: 15 } })))
      ).toContain(DND5E_STABILIZE_PROPOSAL_OPERATION_KEY)
  })

  it('refuses a contest whose win kills its target outright, which no gate admits', () => {
    expect(() => compile(checkWinning({ effectKind: 'KILL' }))).toThrow(
      'D&D test action outcome is not supported.'
    )
  })

  it('compiles the SRD Grapple, a contest, to the two-roller contest graph', () => {
    const published = compile(basicActionEffect(SRD_BASIC_ACTION_IDS.GRAPPLE))
    expect(published.id).toBe(ACTION_EFFECT_ID)
    expect(Object.keys(published.definition.outputs).sort()).toEqual([
      'initiatorNaturalD20',
      'initiatorTotal',
      'targetNaturalD20',
      'targetTotal'
    ])
  })

  it('holds the Grapple target under a relationship its check success applies', () => {
    const action = srdAction(basicActionEffect(SRD_BASIC_ACTION_IDS.GRAPPLE))
    const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
    const [plan, ...rest] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action,
      published
    })
    expect(rest).toEqual([])
    expect(plan?.adapterFacts['dnd5e.relationship-authored-path']).toBe('ON_CHECK_SUCCESS')
    expect(plan?.actorRelationshipContribution?.heldAtOnce).toBe(2)
    expect(plan?.actorRelationshipContribution?.modules.map(({ kind }) => kind)).toEqual([
      'SOURCE_OCCUPIES_HAND',
      'ESCAPE_CHECK',
      'TARGET_DRAGGED'
    ])
  })

  it('refuses an action that lists more than one check, since a resolution names no choice', () => {
    expect(() =>
      compile(
        withCheck({
          checks: { skillIds: [ATHLETICS_ID], abilityDefinitionIds: [STRENGTH_ID] },
          dc: { kind: 'FIXED', value: 10 }
        })
      )
    ).toThrow('exactly one check')
  })

  it('refuses an action that lists no check', () => {
    expect(() =>
      compile(
        withCheck({
          checks: { skillIds: [], abilityDefinitionIds: [] },
          dc: { kind: 'FIXED', value: 10 }
        })
      )
    ).toThrow('exactly one check')
  })
})

describe('the SRD Shove, a contest whose win its shover picks (D105)', () => {
  const adapter = dnd5eCharacterRuleActionSystemAdapter
  const options = () => {
    const action = srdAction(basicActionEffect(SRD_BASIC_ACTION_IDS.SHOVE))
    const picks = castChoiceOptions(action.compiledEffect)
    if (!picks) throw new Error('Shove offers no pick.')
    return picks.map(({ label, compiledEffect }) => {
      const option = { ...action, compiledEffect }
      const compilerSource = buildCompiledActionCompilerSource(option)
      const plan = adapter.compileExecutionPlan?.({ action: option, compilerSource })
      if (plan?.kind !== 'TEST_OUTCOME') throw new Error(`${label} is not a test and its outcome.`)
      return { label, compilerSource, plan }
    })
  }

  it('offers knocking the target prone or pushing it 5 feet away', () => {
    expect(options().map(({ label }) => label)).toEqual(['Knock prone', 'Push 5 feet away'])
  })

  it('tests each pick by the two-roller contest, with an outcome only on the win', () => {
    for (const { plan } of options()) {
      expect(Object.keys(plan.test.published.definition.outputs).sort()).toEqual([
        'initiatorNaturalD20',
        'initiatorTotal',
        'targetNaturalD20',
        'targetTotal'
      ])
      expect(plan.outcomes.map(({ pathCode }) => pathCode)).toEqual(['ON_CHECK_SUCCESS'])
    }
  })

  it('specializes the win to the Prone condition or the push its pick names', () => {
    const [prone, push] = options().map(({ compilerSource, plan }) =>
      adapter.specializeOutcomeTemplate?.({
        compilerSource,
        testTemplate: plan.test,
        selectedPath: 'ON_CHECK_SUCCESS',
        facts: {},
        testRollMode: 'NORMAL'
      })
    )
    expect(operationKeys(prone?.published)).toEqual([DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY])
    expect(operationKeys(push?.published)).toEqual([DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY])
  })
})

describe('a contest whose win settles any outcome on its target (D173)', () => {
  const adapter = dnd5eCharacterRuleActionSystemAdapter

  it.each([
    ['dice damage', { valueKind: 'DICE', scalingKind: 'NONE', diceConfig: '1d6' }],
    ['fixed damage', { valueKind: 'FIXED', scalingKind: 'NONE', amount: 3 }]
  ])('specializes the win to %s', (_name, amount) => {
    const action = srdAction(
      checkWinning({ effectKind: 'DAMAGE', damageTypeId: SRD_BLUDGEONING_ID, ...amount })
    )
    const compilerSource = buildCompiledActionCompilerSource(action)
    const plan = adapter.compileExecutionPlan?.({ action, compilerSource })
    if (plan?.kind !== 'TEST_OUTCOME') throw new Error('The contest is not a test and its outcome.')
    const won = adapter.specializeOutcomeTemplate?.({
      compilerSource,
      testTemplate: plan.test,
      selectedPath: 'ON_CHECK_SUCCESS',
      facts: {},
      testRollMode: 'NORMAL'
    })
    expect(operationKeys(won?.published)).toContain(DND5E_DAMAGE_PROPOSAL_OPERATION_KEY)
  })
})

describe('a fixed-DC check whose success settles any outcome on its target (D173)', () => {
  const adapter = dnd5eCharacterRuleActionSystemAdapter
  const FIXED_DC = { kind: 'FIXED', value: 12 }
  const plan = (outcome: Record<string, unknown>) => {
    const action = srdAction(checkWinning(outcome, FIXED_DC))
    const compilerSource = buildCompiledActionCompilerSource(action)
    const compiled = adapter.compileExecutionPlan?.({ action, compilerSource })
    if (compiled?.kind !== 'TEST_OUTCOME')
      throw new Error('The check is not a test and its outcome.')
    return { compilerSource, compiled }
  }
  const specialize = (outcome: Record<string, unknown>) => {
    const { compilerSource, compiled } = plan(outcome)
    return adapter.specializeOutcomeTemplate?.({
      compilerSource,
      testTemplate: compiled.test,
      selectedPath: 'ON_CHECK_SUCCESS',
      facts: {},
      testRollMode: 'NORMAL'
    })
  }
  const damage = {
    effectKind: 'DAMAGE',
    damageTypeId: SRD_BLUDGEONING_ID,
    valueKind: 'FIXED',
    scalingKind: 'NONE',
    amount: 3
  }

  it('tests by one d20 check with its added dice, with an outcome only on success', () => {
    const { compiled } = plan(damage)
    expect(Object.keys(compiled.test.published.definition.outputs).sort()).toEqual([
      'addedTotal',
      'rawDie'
    ])
    expect(compiled.outcomes.map(({ pathCode }) => pathCode)).toEqual(['ON_CHECK_SUCCESS'])
  })

  it.each([
    ['dice damage', { ...damage, valueKind: 'DICE', diceConfig: '1d6' }],
    ['fixed damage', damage]
  ])('specializes the success to %s', (_name, outcome) => {
    expect(operationKeys(specialize(outcome)?.published)).toContain(
      DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
    )
  })

  it('specializes the success to a condition', () => {
    const prone = SRD_CONDITION_TYPES.find(({ code }) => code === 'PRONE')!.id
    expect(
      operationKeys(specialize({ effectKind: 'CONDITION', conditionId: prone })?.published)
    ).toEqual([DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY])
  })
})
