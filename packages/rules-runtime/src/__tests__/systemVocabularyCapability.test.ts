import { describe, expect, it } from 'vitest'

import { rollModeCapabilityRegistry } from '../platformPolicyModules.js'
import { createSystemVocabularyRegistry } from '../systemVocabularyCapability.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { systemVocabularyRegistry } from '../platformSystemVocabulary.js'
import { dnd5eVocabularyCapabilityAdapter } from '../systems/dnd5e/vocabulary.js'

const UNKNOWN_SYSTEM_ID = '00000000-0000-4000-8000-0000000000ff'

describe('System vocabulary registry', () => {
  it('returns the code and label the installed System defines', () => {
    expect(systemVocabularyRegistry.requireCode(DND5E_SYSTEM_ID, 'rollMode', 'ADVANTAGE')).toEqual({
      code: 'ADVANTAGE',
      label: 'Advantage',
      description: 'Roll two d20s and use the higher.'
    })
    expect(
      systemVocabularyRegistry.entries(DND5E_SYSTEM_ID, 'rollInfluence').map(({ code }) => code)
    ).toEqual(['ADVANTAGE', 'DISADVANTAGE'])
  })

  it('refuses a code outside the list it is checked against', () => {
    expect(() =>
      systemVocabularyRegistry.requireCode(DND5E_SYSTEM_ID, 'rollInfluence', 'NORMAL')
    ).toThrow('The Game System does not define the roll-mode influence "NORMAL".')
    expect(() => systemVocabularyRegistry.requireCode(DND5E_SYSTEM_ID, 'rollMode', 'BOON')).toThrow(
      'The Game System does not define the roll mode "BOON".'
    )
    expect(() =>
      systemVocabularyRegistry.requireCode(DND5E_SYSTEM_ID, 'rollMode', 'AUTO_HIT')
    ).toThrow('The Game System does not define the roll mode "AUTO_HIT".')
  })

  it('fails closed on a System with no vocabulary', () => {
    expect(() => systemVocabularyRegistry.entries(UNKNOWN_SYSTEM_ID, 'rollMode')).toThrow(
      'The Game System does not provide vocabulary policy.'
    )
  })

  it('refuses a list with a duplicate code', () => {
    const advantage = { code: 'ADVANTAGE', label: 'Advantage' }
    expect(() =>
      createSystemVocabularyRegistry([
        {
          ...dnd5eVocabularyCapabilityAdapter,
          lists: {
            ...dnd5eVocabularyCapabilityAdapter.lists,
            rollInfluence: [advantage, advantage]
          }
        }
      ])
    ).toThrow('Duplicate roll-mode influence code.')
  })
})

describe('roll-mode keep and passive score', () => {
  it('derives the kept face from the System roll mode and refuses a mismatched keep', () => {
    expect(
      rollModeCapabilityRegistry.rollModeKeep({ gameSystemId: DND5E_SYSTEM_ID, rollMode: 'NORMAL' })
    ).toBe('FIRST')
    expect(() =>
      rollModeCapabilityRegistry.requireKeep({
        gameSystemId: DND5E_SYSTEM_ID,
        rollMode: 'ADVANTAGE',
        keep: 'LOWER'
      })
    ).toThrow('The roll mode "ADVANTAGE" does not keep the LOWER face.')
    expect(() =>
      rollModeCapabilityRegistry.rollModeKeep({ gameSystemId: DND5E_SYSTEM_ID, rollMode: 'BOON' })
    ).toThrow('The Game System does not define the roll mode "BOON".')
  })

  it('refuses a passive score under a roll mode the System does not define', () => {
    expect(() =>
      rollModeCapabilityRegistry.passiveScore({
        gameSystemId: DND5E_SYSTEM_ID,
        skillModifier: 3,
        rollMode: 'BOON'
      })
    ).toThrow('The Game System does not define the roll mode "BOON".')
  })
})
