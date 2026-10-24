import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { ACTIVATION_CODE } from '@artificer-toolkit/shared/core'
import { shortsword } from '@artificer-toolkit/source-data/srd/equipment/shortsword.js'
import { spiritualWeapon } from '@artificer-toolkit/source-data/srd/spells/spiritual-weapon.js'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

/** The Shortsword's melee weapon attack, authored with the given activation. */
function shortswordAttack(activationCode: string): EffectAuthored {
  const effect = shortsword.effects?.[0]
  if (!effect || effect.invocation.kind !== 'ACTION')
    throw new Error('The Shortsword has no action effect.')
  return {
    ...effect,
    id: ACTION_EFFECT_ID,
    invocation: { ...effect.invocation, activation: { code: activationCode, amount: 1 } }
  } as EffectAuthored
}

/** The execution plan an Encounter compiles for the attack, as a Character's item action does. */
const compile = (effect: EffectAuthored) => {
  const action = characterActionDescriptor(compileEffect(effect))
  return dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
}

describe('a weapon attack authored as a bonus action (two-weapon fighting)', () => {
  it('compiles, as the same attack authored as an Action does', () => {
    expect(() => compile(shortswordAttack(ACTIVATION_CODE.ACTION))).not.toThrow()
    expect(() => compile(shortswordAttack(ACTIVATION_CODE.BONUS_ACTION))).not.toThrow()
  })

  it('still refuses a weapon attack authored with a Reaction activation and no movement trigger', () => {
    expect(() => compile(shortswordAttack(ACTIVATION_CODE.REACTION))).toThrow()
  })
})

describe('a spell attack authored as a bonus action (SPELLS-4.T2v2a3d)', () => {
  it('compiles, as Spiritual Weapon’s attack is a bonus action', () => {
    const attack = spiritualWeapon.effects?.find(
      (effect) =>
        effect.invocation.kind === 'ACTION' &&
        effect.invocation.triggerCode === 'MELEE_SPELL_ATTACK'
    )
    if (!attack || attack.invocation.kind !== 'ACTION')
      throw new Error('Spiritual Weapon has no attack.')
    expect(attack.invocation.activation.code).toBe(ACTIVATION_CODE.BONUS_ACTION)
    expect(() => compile({ ...attack, id: ACTION_EFFECT_ID } as EffectAuthored)).not.toThrow()
  })
})
