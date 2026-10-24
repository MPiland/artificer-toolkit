import { describe, expect, it } from 'vitest'
import {
  NUMERIC_EXPR_CODE,
  evaluateNumericExpr,
  type NumericExpr
} from '../domains/core/numericExpr.js'

const fixed = (value: number) => ({ kind: NUMERIC_EXPR_CODE.FIXED, value }) as const
const hitPointMaximum = { kind: NUMERIC_EXPR_CODE.HIT_POINT_MAXIMUM } as const

describe('evaluateNumericExpr', () => {
  it('reads fixed values and the hit point maximum fact', () => {
    expect(evaluateNumericExpr(fixed(8), {})).toBe(8)
    expect(evaluateNumericExpr(hitPointMaximum, { hitPointMaximum: 30 })).toBe(30)
  })

  it('combines terms by addition, multiplication and clamping', () => {
    const half: NumericExpr = {
      kind: NUMERIC_EXPR_CODE.ADD,
      args: [fixed(5), { kind: NUMERIC_EXPR_CODE.MUL, left: hitPointMaximum, right: fixed(2) }]
    }
    expect(evaluateNumericExpr(half, { hitPointMaximum: 10 })).toBe(25)
    expect(
      evaluateNumericExpr(
        { kind: NUMERIC_EXPR_CODE.CLAMP, value: half, min: 1, max: 20 },
        {
          hitPointMaximum: 10
        }
      )
    ).toBe(20)
  })

  it('is null when it reads a fact the caller does not carry', () => {
    expect(evaluateNumericExpr(hitPointMaximum, {})).toBeNull()
    expect(evaluateNumericExpr({ kind: NUMERIC_EXPR_CODE.PROFICIENCY_BONUS }, {})).toBeNull()
    expect(
      evaluateNumericExpr({ kind: NUMERIC_EXPR_CODE.ADD, args: [fixed(1), hitPointMaximum] }, {})
    ).toBeNull()
  })
})
