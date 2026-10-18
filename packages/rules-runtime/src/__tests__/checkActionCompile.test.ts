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
  SRD_CONDITION_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  DND5E_STABILIZE_PROPOSAL_OPERATION_KEY,
  dnd5eCharacterRuleActionSystemAdapter
} from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

const ATHLETICS_ID = SRD_ATHLETICS_SKILL_ID
const STRENGTH_ID = SRD_ABILITY_DEFINITION_IDS.STRENGTH

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

describe('the CHECK action test compiles through the dnd5e adapter', () => {
  it('compiles First Aid, authored as a Medicine check against DC 10, to the stabilize proposal', () => {
    expect(operationKeys(compile(firstAidEffect()))).toContain(
      DND5E_STABILIZE_PROPOSAL_OPERATION_KEY
    )
  })

  it('compiles any authored single check, a skill or an ability, against a fixed DC', () => {
    for (const checks of [
      { skillIds: [ATHLETICS_ID], abilityDefinitionIds: [] },
      { skillIds: [], abilityDefinitionIds: [STRENGTH_ID] }
    ])
      expect(
        operationKeys(compile(withCheck({ checks, dc: { kind: 'FIXED', value: 15 } })))
      ).toContain(DND5E_STABILIZE_PROPOSAL_OPERATION_KEY)
  })

  it('refuses a contest whose success is not a relationship', () => {
    expect(() =>
      compile(
        withCheck({
          checks: { skillIds: [ATHLETICS_ID], abilityDefinitionIds: [] },
          dc: { kind: 'CONTEST', checks: { skillIds: [ATHLETICS_ID], abilityDefinitionIds: [] } }
        })
      )
    ).toThrow('check action outcome')
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
      'ESCAPE_CHECK'
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
