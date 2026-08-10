import { describe, expect, it } from 'vitest'
import { assertCampaignGmSheetCommandAllowed } from './sheetCommandValidation.js'

describe('character sheet command validation', () => {
  it('allows campaign owners to issue known-spell commands', () => {
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'SET_KNOWN_SPELLS',
        classId: 'class-1',
        spellIds: [],
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: 1
      })
    ).not.toThrow()
  })
})
