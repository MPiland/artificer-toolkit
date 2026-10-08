import { describe, expect, it } from 'vitest'
import {
  concentrationPromptText,
  concentrationTriggerText,
  deathSavePromptText
} from './ruleCheckCopy'

describe('death save copy', () => {
  it('names the actor and the saves already held', () => {
    expect(deathSavePromptText('Aria', { successes: 1, failures: 2 })).toBe(
      'Death save for Aria (1 success, 2 failures, no modifiers)'
    )
    expect(deathSavePromptText('Aria', { successes: 0, failures: 1 })).toBe(
      'Death save for Aria (0 successes, 1 failure, no modifiers)'
    )
  })
})

describe('Concentration check copy', () => {
  it('names the actor, damage, source and DC', () => {
    expect(
      concentrationPromptText('Mira', {
        damage: { amount: 12, typeLabel: 'Fire' },
        sourceLabel: 'Fire Bolt',
        dc: 10
      })
    ).toBe('Concentration check for Mira: took 12 fire from Fire Bolt (DC 10)')
  })

  it('falls back to plain damage when the type or source has no name', () => {
    expect(
      concentrationTriggerText({
        damage: { amount: 30, typeLabel: null },
        sourceLabel: null,
        dc: 15
      })
    ).toBe('took 30 damage (DC 15)')
  })
})
