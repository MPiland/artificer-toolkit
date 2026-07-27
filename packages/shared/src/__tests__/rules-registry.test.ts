import { describe, expect, it } from 'vitest'

import {
  dnd5e2014RulesSystem,
  resolveRulesSystem,
  UnsupportedRulesSystemError
} from '@artificer-toolkit/shared'

describe('resolveRulesSystem', () => {
  it('resolves the persisted D&D 5e 2014 identity', () => {
    expect(resolveRulesSystem({ code: 'dnd5e', version: '2014' })).toBe(dnd5e2014RulesSystem)
  })

  it('fails closed for unsupported systems and versions', () => {
    expect(() => resolveRulesSystem({ code: 'dnd5e', version: '2024' })).toThrow(
      UnsupportedRulesSystemError
    )
    expect(() => resolveRulesSystem({ code: 'pf2e', version: 'remaster' })).toThrow(
      'Unsupported rules system'
    )
  })
})
