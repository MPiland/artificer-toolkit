import { describe, expect, it } from 'vitest'
import { rollPromptText } from './CampaignTabletopDecisionDrawer.model'

describe('rollPromptText', () => {
  it('names a death save with the saves already held', () => {
    expect(rollPromptText('Aria', { kind: 'DEATH_SAVE', successes: 1, failures: 2 })).toBe(
      'Death save for Aria (1 success, 2 failures, no modifiers)'
    )
  })

  it('names a basic action check with its action, check and DC', () => {
    expect(
      rollPromptText('Aria', {
        kind: 'BASIC_ACTION_CHECK',
        actionLabel: 'First Aid',
        checkLabel: 'Wisdom (Medicine)',
        dc: 10
      })
    ).toBe('First Aid: Wisdom (Medicine) DC 10')
  })

  it('falls back to naming the roller', () => {
    expect(rollPromptText('Aria', undefined)).toBe('Roll for Aria')
  })
})
