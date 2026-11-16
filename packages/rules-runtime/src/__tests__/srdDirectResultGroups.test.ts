import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import {
  buildCompiledActionTargetPolicy,
  compileCastChoicePlans
} from '../encounterActionEntryPointCompiler.js'
import { isActivatedEffect } from '../spellCastCandidates.js'
import { rulingSequence } from '../systems/dnd5e/effectActionResultSequences.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

/**
 * QUALITY-15 T3c: SRD spells whose direct results the compiler used to refuse compile through the
 * product's cast entry, from the real SRD data and compilers.
 */

function castOf(spellLabel: string) {
  const spell = srdByLabel(SRD.spells, spellLabel)
  const effects = spell.effects ?? []
  const effect = effects.find(isActivatedEffect)
  if (!effect) throw new Error(`${spellLabel} has no activated effect.`)
  const compiled = compileSpellEffect(
    { attributes: spell.attributes, effects },
    { ...effect, id: ACTION_EFFECT_ID }
  )
  const action = {
    ...characterActionDescriptor(compiled, spell.level, 20),
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id)
  }
  return { action, compiled }
}

const compile = (spellLabel: string) => {
  const { action } = castOf(spellLabel)
  return compileCastChoicePlans(
    dnd5eCharacterRuleActionSystemAdapter,
    action,
    buildCompiledActionTargetPolicy(action)
  )
}

describe('a sequence of GM rulings alone', () => {
  it.each(['Awaken', 'Contingency', 'Glyph of Warding'])(
    '%s leads with its first ruling and keeps the others beside it',
    (label) => {
      const { action } = castOf(label)
      const entries = action.compiledEffect.entries
      const split = rulingSequence(action)
      expect(split).not.toBeNull()
      expect(split!.executable.compiledEffect.entries).toHaveLength(1)
      expect(split!.executable.compiledEffect.entries[0]).toMatchObject({
        entryId: entries[0]!.entryId,
        groupKind: 'SINGLE'
      })
      expect(split!.rulings.length).toBe(entries.length - 1)
      expect(() => compile(label)).not.toThrow()
    }
  )
})

describe('a cast pick whose options each grant', () => {
  it('compiles one execution plan per option of Enhance Ability', () => {
    const { choice } = compile('Enhance Ability')
    expect(choice?.options.length).toBeGreaterThan(1)
    for (const option of choice?.options ?? []) {
      expect(option.executionPlan.kind).toBe('SINGLE_GRAPH')
      expect(option.activeEffectPlan).toBeDefined()
    }
  })
})

describe('a grant and a GM ruling in one sequence', () => {
  it('compiles Irresistible Dance as its grant with the ruling beside it', () => {
    const { action } = castOf('Irresistible Dance')
    expect(action.compiledEffect.entries.every(({ groupKind }) => groupKind === 'SEQUENTIAL')).toBe(
      true
    )
    expect(rulingSequence(action)?.rulings).toHaveLength(1)
    expect(compile('Irresistible Dance').executionPlan.kind).toBe('SINGLE_GRAPH')
  })
})
