import { describe, expect, it } from 'vitest'

import {
  BOUNDED_USAGE_RECONCILIATION_POLICY,
  reconcileBoundedUsageTrack
} from '../domains/rules/boundedUsageTrack.js'

describe('bounded usage track reconciliation', () => {
  const policy = BOUNDED_USAGE_RECONCILIATION_POLICY.CLAMP_USED_TO_MAXIMUM

  it('preserves usage when the maximum increases or remains equal', () => {
    const input = {
      previousMaximum: 3,
      nextMaximum: 5,
      previousUsed: 2,
      policy
    } as const
    expect(reconcileBoundedUsageTrack(input)).toEqual({
      policy,
      previousMaximum: 3,
      nextMaximum: 5,
      previousUsed: 2,
      used: 2,
      remaining: 3,
      reconciled: false,
      reason: 'UNCHANGED'
    })
    expect(
      reconcileBoundedUsageTrack({
        ...input,
        previousMaximum: 5,
        nextMaximum: 5
      })
    ).toMatchObject({
      used: 2,
      remaining: 3,
      reconciled: false
    })
    expect(input).toEqual({
      previousMaximum: 3,
      nextMaximum: 5,
      previousUsed: 2,
      policy
    })
  })

  it('clamps usage only when a maximum falls below it, including zero', () => {
    expect(
      reconcileBoundedUsageTrack({
        previousMaximum: 5,
        nextMaximum: 2,
        previousUsed: 4,
        policy
      })
    ).toEqual(
      expect.objectContaining({
        used: 2,
        remaining: 0,
        reconciled: true,
        reason: 'USED_CLAMPED_TO_MAXIMUM'
      })
    )
    expect(
      reconcileBoundedUsageTrack({
        previousMaximum: 2,
        nextMaximum: 0,
        previousUsed: 1,
        policy
      })
    ).toEqual(expect.objectContaining({ used: 0, remaining: 0, reconciled: true }))
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid bounded usage inputs: %s',
    (invalid) => {
      expect(() =>
        reconcileBoundedUsageTrack({
          previousMaximum: invalid,
          nextMaximum: 1,
          previousUsed: 0,
          policy
        })
      ).toThrow(/nonnegative safe integer/)
    }
  )
})
