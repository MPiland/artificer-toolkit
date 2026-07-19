import { describe, expect, it } from 'vitest'
import { toAuthoredValidationIssues } from '../api/content.js'

describe('toAuthoredValidationIssues', () => {
  it('preserves nested string and numeric paths in the authored validation contract', () => {
    expect(
      toAuthoredValidationIssues([
        {
          code: 'invalid_type',
          message: 'Expected a string',
          path: ['features', 1, 'label']
        }
      ])
    ).toEqual([
      {
        code: 'invalid_type',
        message: 'Expected a string',
        path: ['features', 1, 'label']
      }
    ])
  })
})
