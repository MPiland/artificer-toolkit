import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { describe, expect, it } from 'vitest'

import {
  DND5E_RESOLVED_HEAL_AMOUNT_FACT_KEY,
  Dnd5eEffectActionCompilerError
} from '../systems/dnd5e/effectActionContracts.js'
import { resolvedHealAmountFacts } from '../systems/dnd5e/effectActionHealAmountFacts.js'
import type { Dnd5eAuthoredOutcome } from '../systems/dnd5e/effectActionOutcomes.js'
import { isBonusAmountHeal } from '../systems/dnd5e/effectActionTestOutcomes.js'

type Heal = Extract<Dnd5eAuthoredOutcome, { effectKind: 'HEAL' }>

const bonuses = [
  {
    id: '00000000-0000-4000-8000-0000000000b1',
    bonusKind: 'CLASS_LEVEL',
    classId: '00000000-0000-4000-8000-0000000000a1',
    multiplier: 3,
    order: 0
  }
]

/** A fixed heal whose amount comes only from its bonuses, with the named fields overridden. */
const heal = (overrides: Record<string, unknown> = {}) =>
  ({
    effectKind: 'HEAL',
    valueKind: 'FIXED',
    amount: 0,
    scalingKind: 'NONE',
    bonuses,
    ...overrides
  }) as unknown as Heal

/** A published graph whose one node binds `factKey` as an input, or no fact at all. */
const published = (factKey: string | null) =>
  ({
    definition: {
      nodes: [{ inputs: factKey ? { amount: { kind: 'FACT', factKey } } : {} }]
    }
  }) as unknown as ServerPublishedRuleDefinitionDto

describe('isBonusAmountHeal', () => {
  it('names a non-temporary fixed heal of bonuses alone', () => {
    expect(isBonusAmountHeal(heal())).toBe(true)
  })

  it.each([
    ['a heal with a base amount', { amount: 5 }],
    ['a temporary heal', { temporary: true }],
    ['a scaled heal', { scalingKind: 'PER_LEVEL' }],
    ['a heal with no bonuses', { bonuses: undefined }],
    ['a heal with an empty bonus list', { bonuses: [] }],
    ['a pool heal', { valueKind: 'POOL' }]
  ])('leaves %s to its own path', (_name, overrides) => {
    expect(isBonusAmountHeal(heal(overrides))).toBe(false)
  })
})

describe('resolvedHealAmountFacts', () => {
  it('binds the one exact amount the Sheet resolved', () => {
    expect(
      resolvedHealAmountFacts(published(DND5E_RESOLVED_HEAL_AMOUNT_FACT_KEY), [
        { expression: '18' }
      ])
    ).toEqual({ [DND5E_RESOLVED_HEAL_AMOUNT_FACT_KEY]: 18 })
  })

  it('binds nothing for a graph that does not read it', () => {
    expect(resolvedHealAmountFacts(published(null), [])).toEqual({})
  })

  it.each([[[]], [[{ expression: '1d6' }]], [[{ expression: '3' }, { expression: '4' }]]])(
    'refuses a graph that reads it when the rows are %j',
    (rows) => {
      expect(() =>
        resolvedHealAmountFacts(published(DND5E_RESOLVED_HEAL_AMOUNT_FACT_KEY), rows)
      ).toThrow(
        new Dnd5eEffectActionCompilerError('D&D bonus healing requires one exact resolved amount.')
      )
    }
  )
})
