import { describe, expect, it } from 'vitest'

import { CharacterRuleActionUnsupportedCompilationError } from '../characterRuleActionSystemAdapter.js'
import {
  DND5E_CLASS_LEVELS_FACT_KEY,
  DND5E_CRITICAL_EXTRA_DICE_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY,
  DND5E_SPELL_CAST_LEVEL_FACT_KEY
} from '../systems/dnd5e/effectActionContracts.js'
import {
  boundedDiceTerm,
  boundedSingleDiceCount,
  dnd5eEffectScalingFacts,
  parseBoundedDiceConfiguration,
  scalingLevel
} from '../systems/dnd5e/effectActionScalingFacts.js'

const WIZARD = '00000000-0000-4000-8000-0000000000a1'
const FIGHTER = '00000000-0000-4000-8000-0000000000a2'

function scalingFacts(facts: Record<string, string | number | boolean>) {
  return dnd5eEffectScalingFacts({ facts, testOutputs: undefined, testRollMode: 'NORMAL' })
}

describe('dnd5eEffectScalingFacts', () => {
  it('derives the character level from class levels and keeps only positive integer levels', () => {
    const facts = scalingFacts({
      [DND5E_CLASS_LEVELS_FACT_KEY]: JSON.stringify({ [WIZARD]: 3, [FIGHTER]: 2 }),
      [DND5E_SPELL_CAST_LEVEL_FACT_KEY]: 0,
      parentClassLevel: 2.5,
      [DND5E_CRITICAL_EXTRA_DICE_FACT_KEY]: -1
    })
    expect(facts.characterLevel).toBe(5)
    expect(facts.classLevels).toEqual({ [WIZARD]: 3, [FIGHTER]: 2 })
    expect(facts.spellCastLevel).toBeUndefined()
    expect(facts.parentClassLevel).toBeUndefined()
    expect(facts.criticalExtraDice).toBeUndefined()
  })

  it('gives a Creature no character level, no class levels and no chosen riders', () => {
    const facts = scalingFacts({})
    expect(facts.characterLevel).toBeUndefined()
    expect(facts.classLevels).toEqual({})
    expect(facts.selectedOptionalRiderIds).toEqual([])
    expect(facts.resolvedDamageExpressions).toEqual({})
    expect(facts.resolvedDamageOutcomeExpressions).toEqual({})
  })

  it.each([
    JSON.stringify({ [WIZARD]: 0 }),
    JSON.stringify({ [WIZARD]: 1.5 }),
    JSON.stringify([3]),
    'not json'
  ])('rejects malformed class levels %s at the boundary', (classLevels) => {
    expect(() => scalingFacts({ [DND5E_CLASS_LEVELS_FACT_KEY]: classLevels })).toThrow(
      new CharacterRuleActionUnsupportedCompilationError('D&D class levels are malformed.')
    )
  })

  it('rejects malformed optional rider choices at the boundary', () => {
    expect(() =>
      scalingFacts({ [DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY]: JSON.stringify([1]) })
    ).toThrow(
      new CharacterRuleActionUnsupportedCompilationError(
        'D&D selected optional riders are malformed.'
      )
    )
  })

  it('carries the settled roll mode and the margin a save failed by', () => {
    const facts = dnd5eEffectScalingFacts({
      facts: { [DND5E_SAVE_DC_FACT_KEY]: 15 },
      testOutputs: { total: 9 },
      testRollMode: 'DISADVANTAGE'
    })
    expect(facts.attackRollMode).toBe('DISADVANTAGE')
    expect(facts.saveFailedBy).toBe(6)
  })
})

describe('scalingLevel', () => {
  const facts = scalingFacts({
    [DND5E_CLASS_LEVELS_FACT_KEY]: JSON.stringify({ [WIZARD]: 7 }),
    [DND5E_SPELL_CAST_LEVEL_FACT_KEY]: 3,
    parentClassLevel: 7
  })

  it('reads the level each scaling source names', () => {
    expect(scalingLevel({ scalingSource: 'CHARACTER_LEVEL' }, facts)).toBe(7)
    expect(scalingLevel({ scalingSource: 'PARENT_CLASS_LEVEL' }, facts)).toBe(7)
    expect(scalingLevel({ scalingSource: 'SPELL_CAST_LEVEL' }, facts)).toBe(3)
    expect(scalingLevel({ scalingSource: 'CLASS_LEVEL', classId: WIZARD }, facts)).toBe(7)
  })

  it('refuses a source whose fact is unavailable', () => {
    expect(() => scalingLevel({ scalingSource: 'SPELL_CAST_LEVEL' }, scalingFacts({}))).toThrow(
      new CharacterRuleActionUnsupportedCompilationError('D&D dice scaling facts are unavailable.')
    )
    expect(() => scalingLevel({ scalingSource: 'CLASS_LEVEL' }, facts)).toThrow(
      new CharacterRuleActionUnsupportedCompilationError(
        'D&D class dice scaling has no class identity.'
      )
    )
    for (const classId of [FIGHTER, 'constructor'])
      expect(() => scalingLevel({ scalingSource: 'CLASS_LEVEL', classId }, facts)).toThrow(
        new CharacterRuleActionUnsupportedCompilationError(
          'D&D class dice scaling facts are unavailable.'
        )
      )
  })
})

describe('the bounded exact-dice contract', () => {
  it('parses one plain term and its flat modifier', () => {
    expect(parseBoundedDiceConfiguration('2d6+3')).toEqual({
      term: expect.objectContaining({ count: 2, die: 6 }),
      modifier: 3
    })
  })

  it.each(['2d6+1d4', '32d6', '1d1', '1d1001', '4d6kh3'])('refuses %s', (dice) => {
    expect(() => parseBoundedDiceConfiguration(dice)).toThrow(
      CharacterRuleActionUnsupportedCompilationError
    )
  })

  it('doubles a critical hit, adds its extra dice and keeps the bound', () => {
    expect(boundedDiceTerm('2d6+3', { extraDice: 1 })).toEqual({
      term: expect.objectContaining({ count: 5, die: 6 }),
      modifier: 3
    })
    expect(() => boundedDiceTerm('15d6', { extraDice: 2 })).toThrow(
      new CharacterRuleActionUnsupportedCompilationError(
        'D&D dice configuration exceeds the bounded exact-dice contract.'
      )
    )
  })

  it('counts the dice of one plain term and reads anything else as no count', () => {
    expect(boundedSingleDiceCount('3d8')).toBe(3)
    expect(boundedSingleDiceCount('3d8+2')).toBeNull()
    expect(boundedSingleDiceCount('2d6+1d4')).toBeNull()
    expect(boundedSingleDiceCount('not dice')).toBeNull()
    expect(boundedSingleDiceCount(undefined)).toBeNull()
  })
})
