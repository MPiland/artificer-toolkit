import { describe, expect, it } from 'vitest'

import { srdBaselineContent } from '../srd/index.js'

/** Paths of every `undefined` under a value; authored rules data is JSON, where `undefined` is not a value. */
function undefinedPaths(value: unknown, path: string): string[] {
  if (value === undefined) return [path]
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, entry]) => undefinedPaths(entry, `${path}.${key}`))
}

describe('SRD baseline content', () => {
  it('holds JSON values only, with no explicit undefined properties', () => {
    expect(undefinedPaths(srdBaselineContent, 'srd')).toEqual([])
  })
})
