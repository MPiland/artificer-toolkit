import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { crowbar } from '@artificer-toolkit/source-data/srd/equipment/crowbar.js'
import { lance } from '@artificer-toolkit/source-data/srd/equipment/lance.js'
import { portableRam } from '@artificer-toolkit/source-data/srd/equipment/portable-ram.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY } from '../systems/dnd5e/effectActionContracts.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

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

/** The execution plan a Character action compiles to from one authored Effect. */
function planOf(effect: EffectAuthored | undefined) {
  if (!effect) throw new Error('Missing SRD effect.')
  const action = {
    ...characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID })),
    conditionDefinitionIds: SRD_CONDITION_TYPES.map(({ id }) => id)
  }
  return dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
}

describe('the Crowbar and Portable Ram check grants compile from core options (SPELLS-4.T4b)', () => {
  it.each([
    ['Crowbar', crowbar],
    ['Portable Ram', portableRam]
  ])('compiles the %s’s free action to its modifier grant', (_, item) => {
    const plan = planOf(item.effects?.[0])
    expect(plan?.kind).toBe('SINGLE_GRAPH')
    expect(operationKeys(plan)).toContain(DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY)
  })
})

describe('an attack’s close range (D217)', () => {
  it('compiles the SRD Lance, whose reach has a 5 ft close range, as an attack', () => {
    expect(planOf(lance.effects?.[0])?.kind).toBe('TEST_OUTCOME')
  })

  it('refuses a close range on a save, which has no attack roll to give disadvantage to', () => {
    const sacredFlame = srdSpells.find(({ label }) => label === 'Sacred Flame')?.effects?.[0]
    if (sacredFlame?.invocation.range.rangeKind !== 'DISTANCE')
      throw new Error('Sacred Flame must author a distance range.')
    expect(planOf(sacredFlame)?.kind).toBe('TEST_OUTCOME')
    const withCloseRange = {
      ...sacredFlame,
      invocation: {
        ...sacredFlame.invocation,
        range: { ...sacredFlame.invocation.range, closeAmount: 5 }
      }
    }
    expect(() => planOf(withCloseRange)).toThrow(
      'D&D test action has an unsupported bounded shape.'
    )
  })
})
