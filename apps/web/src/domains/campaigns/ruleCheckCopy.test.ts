import { describe, expect, it } from 'vitest'
import { concentrationPromptText, concentrationTriggerText } from './ruleCheckCopy'

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
