import { describe, expect, it } from 'vitest'
import { rollPromptText } from './CampaignTabletopDecisionDrawer.model'

describe('rollPromptText', () => {
  it('names a death save with the saves already held', () => {
    expect(rollPromptText('Aria', { kind: 'DEATH_SAVE', successes: 1, failures: 2 })).toBe(
      'Death save for Aria (1 success, 2 failures, no modifiers)'
    )
  })

  it('falls back to naming the roller', () => {
    expect(rollPromptText('Aria', undefined)).toBe('Roll for Aria')
  })
})
