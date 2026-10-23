import { describe, expect, it } from 'vitest'
import {
  evaluateRollExpression,
  parseRollExpression,
  parseStandaloneDiceConfiguration
} from '../domains/rolls/index.js'

describe('roll expressions', () => {
  it('normalizes and deterministically evaluates ordered mixed dice evidence', () => {
    const values = [0, 5, 19]
    const result = evaluateRollExpression(parseRollExpression('double 2D6 + d20 - 3'), {
      nextInt: () => values.shift() ?? 0
    })

    expect(result).toEqual({
      normalizedExpression: 'double 2d6 + 1d20 - 3',
      evidence: {
        terms: [
          { count: 2, die: 6, modifier: 0, rolls: [1, 6], subtotal: 7 },
          { count: 1, die: 20, modifier: -3, rolls: [20], subtotal: 20 }
        ],
        modifier: -3,
        keep: 'FIRST',
        subtotal: 24,
        transform: { kind: 'DOUBLE' },
        total: 48
      }
    })
  })

  it('preserves modifiers for each dice term', () => {
    const values = [2, 3, 1]
    const result = evaluateRollExpression(parseRollExpression('2d6 + 3 + 1d4 + 1'), {
      nextInt: () => values.shift() ?? 0
    })

    expect(result).toMatchObject({
      normalizedExpression: '2d6 + 3 + 1d4 + 1',
      evidence: {
        terms: [
          { count: 2, die: 6, modifier: 3, rolls: [3, 4], subtotal: 7 },
          { count: 1, die: 4, modifier: 1, rolls: [2], subtotal: 2 }
        ],
        modifier: 4,
        subtotal: 13,
        total: 13
      }
    })
  })

  it('rerolls matching dice and drops the lowest final result', () => {
    const values = [0, 4, 1, 5, 0, 3]
    const result = evaluateRollExpression(parseStandaloneDiceConfiguration('4d6dl1r1'), {
      nextInt: () => values.shift() ?? 0
    })

    expect(result).toEqual({
      normalizedExpression: '4d6dl1r1',
      evidence: {
        terms: [
          {
            count: 4,
            die: 6,
            modifier: 0,
            rolls: [4, 5, 2, 6],
            rollSequences: [[1, 1, 4], [5], [2], [6]],
            subtotal: 15,
            keptRollIndexes: [0, 1, 3]
          }
        ],
        modifier: 0,
        keep: 'FIRST',
        subtotal: 15,
        transform: { kind: 'NONE' },
        total: 15
      }
    })
  })

  it('rerolls once and supports each keep or drop operator', () => {
    const once = evaluateRollExpression(parseStandaloneDiceConfiguration('2d6ro1'), {
      nextInt: () => 0
    })
    expect(once.evidence.terms[0].rollSequences).toEqual([
      [1, 1],
      [1, 1]
    ])

    expect(parseStandaloneDiceConfiguration('4d6kh3').terms[0].selection?.kind).toBe('KEEP_HIGHEST')
    expect(parseStandaloneDiceConfiguration('4d6kl3').terms[0].selection?.kind).toBe('KEEP_LOWEST')
    expect(parseStandaloneDiceConfiguration('4d6dh1').terms[0].selection?.kind).toBe('DROP_HIGHEST')
  })

  it.each(['4d6r0', '4d6r7', '4d6dl4', '4d6dl1kh3', '4d6r1ro1', '2d6 + 1d4'])(
    'rejects invalid standalone configuration %s',
    (configuration) => {
      expect(() => parseStandaloneDiceConfiguration(configuration)).toThrow()
    }
  )

  it.each(['1d2', '-1d6 + 2', '1d6 + 2 + 3', '1d6 + +2', '41d6', '1d6 * 2', 'Math.random()'])(
    'rejects unsupported or excessive expression %s',
    (expression) => {
      expect(() => parseRollExpression(expression)).toThrow()
    }
  )

  it('applies outer half and integer multiplication', () => {
    const random = { nextInt: () => 4 }
    expect(evaluateRollExpression(parseRollExpression('half of 1d6'), random).evidence.total).toBe(
      2
    )
    expect(
      evaluateRollExpression(parseRollExpression('3 * (1d6 + 1)'), random).evidence.total
    ).toBe(18)
  })

  it('rolls two d20s and keeps the correct result for advantage and disadvantage', () => {
    const advantageValues = [3, 16]
    const advantage = evaluateRollExpression(
      parseRollExpression('1d20 + 4'),
      { nextInt: () => advantageValues.shift() ?? 0 },
      { mode: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' }
    )
    expect(advantage.evidence).toMatchObject({
      terms: [{ count: 2, rolls: [4, 17], subtotal: 17, keptRollIndex: 1 }],
      mode: 'ADVANTAGE',
      modeLabel: 'Advantage',
      keep: 'HIGHER',
      total: 21
    })

    const disadvantageValues = [3, 16]
    const disadvantage = evaluateRollExpression(
      parseRollExpression('1d20 + 4'),
      { nextInt: () => disadvantageValues.shift() ?? 0 },
      { mode: 'DISADVANTAGE', label: 'Disadvantage', keep: 'LOWER' }
    )
    expect(disadvantage.evidence).toMatchObject({
      terms: [{ count: 2, rolls: [4, 17], subtotal: 4, keptRollIndex: 0 }],
      mode: 'DISADVANTAGE',
      modeLabel: 'Disadvantage',
      keep: 'LOWER',
      total: 8
    })
  })

  it('rejects advantage for rolls other than one untransformed d20', () => {
    expect(() =>
      evaluateRollExpression(
        parseRollExpression('2d20'),
        { nextInt: () => 0 },
        {
          mode: 'ADVANTAGE',
          label: 'Advantage',
          keep: 'HIGHER'
        }
      )
    ).toThrow('single d20')
  })

  it.each([
    `1d100 + ${Number.MAX_SAFE_INTEGER}`,
    `2 * (1d100 + ${Number.MAX_SAFE_INTEGER - 100})`,
    `${Number.MAX_SAFE_INTEGER} * (1d100)`
  ])('rejects unsafe totals before evaluation for %s', (expression) => {
    expect(() => parseRollExpression(expression)).toThrow('Roll total is too large.')
  })
})
