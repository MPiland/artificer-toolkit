import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'

import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
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

  it('refuses a self reaction that names no trigger', () => {
    const effect = shieldEffect()
    const { reactionTrigger: _trigger, ...invocation } = effect.invocation as Record<
      string,
      unknown
    >
    expect(() => compile({ ...effect, invocation } as EffectAuthored)).toThrow()
  })
})
