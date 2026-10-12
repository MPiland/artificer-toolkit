import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'

import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

const STABILIZE_OPERATION_KEY = 'dnd5e.stabilize-proposal'
const ATHLETICS_ID = '00000000-0000-0000-0012-000100000000'
const STRENGTH_ID = '00000000-0000-0000-0011-000100000000'

function firstAidEffect(): EffectAuthored {
  const effect = SRD_BASIC_ACTION_DEFINITIONS.find(
    ({ id }) => id === SRD_BASIC_ACTION_IDS.FIRST_AID
  )?.document.effects[0]
  if (!effect) throw new Error('First Aid has no authored effect.')
  return { ...effect, id: ACTION_EFFECT_ID }
}

function withCheck(check: unknown): EffectAuthored {
  const effect = firstAidEffect()
  return { ...effect, invocation: { ...effect.invocation, check } } as EffectAuthored
}

function compile(effect: EffectAuthored) {
  return dnd5eCharacterRuleActionSystemAdapter.compile({
    action: characterActionDescriptor(compileEffect(effect))
  })
}

describe('the CHECK action test compiles through the dnd5e adapter', () => {
  it('compiles First Aid, authored as a Medicine check against DC 10, to the stabilize proposal', () => {
    expect(JSON.stringify(compile(firstAidEffect()))).toContain(STABILIZE_OPERATION_KEY)
  })

  it('compiles any authored single check, a skill or an ability, against a fixed DC', () => {
    for (const checks of [
      { skillIds: [ATHLETICS_ID], abilityDefinitionIds: [] },
      { skillIds: [], abilityDefinitionIds: [STRENGTH_ID] }
    ])
      expect(
        JSON.stringify(compile(withCheck({ checks, dc: { kind: 'FIXED', value: 15 } })))
      ).toContain(STABILIZE_OPERATION_KEY)
  })

  it('refuses a contest until the opposed check exists (ATTACK-7)', () => {
    expect(() =>
      compile(
        withCheck({
          checks: { skillIds: [ATHLETICS_ID], abilityDefinitionIds: [] },
          dc: { kind: 'CONTEST', checks: { skillIds: [ATHLETICS_ID], abilityDefinitionIds: [] } }
        })
      )
    ).toThrow()
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
})
