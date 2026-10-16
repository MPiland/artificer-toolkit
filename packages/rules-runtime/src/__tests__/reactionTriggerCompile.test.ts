import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'

import { CharacterRuleActionUnsupportedCompilationError } from '../characterRuleActionSystemAdapter.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { absorbElementsSpell } from '../testing/absorbElementsSpell.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

const MODIFIER_GRANT_OPERATION_KEY = 'dnd5e.modifier-grant-proposal'

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

function shieldEffect(): EffectAuthored {
  const effect = shield.effects?.[0]
  if (!effect) throw new Error('Shield has no authored effect.')
  return { ...effect, id: ACTION_EFFECT_ID }
}

function compile(effect: EffectAuthored) {
  return dnd5eCharacterRuleActionSystemAdapter.compile({
    action: characterActionDescriptor(compileEffect(effect))
  })
}

describe('a reaction authored with the ATTACKED_SELF trigger compiles through the dnd5e adapter', () => {
  it('carries the real SRD Shield trigger onto its compiled invocation', () => {
    const { invocation } = compileEffect(shieldEffect())
    expect(invocation).toMatchObject({
      activation: { code: 'REACTION', amount: 1 },
      reactionTrigger: { kind: 'ATTACKED_SELF' }
    })
  })

  it('compiles the real SRD Shield, a self reaction, to the modifier grant proposal', () => {
    expect(operationKeys(compile(shieldEffect()))).toContain(MODIFIER_GRANT_OPERATION_KEY)
  })

  it('refuses a REACTION activation that names no trigger as an unsupported action shape', () => {
    const effect = shieldEffect()
    const { reactionTrigger: _trigger, ...invocation } = effect.invocation as Record<
      string,
      unknown
    >
    expect(() => compile({ ...effect, invocation } as EffectAuthored)).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })
})

describe('a reaction authored with the DAMAGE_TAKEN trigger compiles through the dnd5e adapter', () => {
  function absorbElementsEffect(): EffectAuthored {
    const effect = absorbElementsSpell(['FIRE', 'COLD']).effects?.[0]
    if (!effect) throw new Error('The fixture has no authored effect.')
    return { ...effect, id: ACTION_EFFECT_ID }
  }

  it('carries the chosen damage types onto the compiled invocation', () => {
    const { invocation } = compileEffect(absorbElementsEffect())
    expect(invocation).toMatchObject({
      activation: { code: 'REACTION', amount: 1 },
      reactionTrigger: {
        kind: 'DAMAGE_TAKEN',
        damageTypeIds: [expect.any(String), expect.any(String)]
      }
    })
  })

  it('compiles a user-authored Absorb Elements to the modifier grant proposal', () => {
    expect(operationKeys(compile(absorbElementsEffect()))).toContain(MODIFIER_GRANT_OPERATION_KEY)
  })
})
