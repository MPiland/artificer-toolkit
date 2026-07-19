import { describe, expect, it } from 'vitest'
import { getRulesetLabel } from './AuthoringLayout.utils'

describe('getRulesetLabel', () => {
  it('separates the D&D ruleset identity from the SRD system label', () => {
    expect(
      getRulesetLabel({
        label: 'D&D 5e SRD',
        rulesetCode: 'dnd5e',
        rulesetVersion: '2014'
      })
    ).toBe('D&D 5e 2014')
  })

  it('does not repeat a version already present in a system label', () => {
    expect(
      getRulesetLabel({
        label: 'Custom Rules 2026',
        rulesetCode: 'custom',
        rulesetVersion: '2026'
      })
    ).toBe('Custom Rules 2026')
  })
})
