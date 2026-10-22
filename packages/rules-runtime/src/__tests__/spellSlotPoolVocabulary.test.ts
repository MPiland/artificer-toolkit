import { describe, expect, it } from 'vitest'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'

import { buildCharacterSpellRuleFacts } from '../character/characterSpellRuleFacts.js'
import { systemVocabularyRegistry } from '../systemVocabulary.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import {
  SRD,
  evaluateSrdCharacter,
  srdByLabel,
  srdFeature,
  srdRegistry
} from '../testing/dnd5eSrdCharacter.js'

/** SPELLS-31.T5p (D175): the slot pool a spell grant is paid from is System vocabulary. */

const warlock = srdByLabel(SRD.classes, 'Warlock')
const invocations = srdRegistry.classes[warlock.id]!.features!.find(
  (feature) => feature.label === 'Eldritch Invocations'
)!
const dreadfulWord = invocations.options!.find((option) => option.label === 'Dreadful Word')!

const character = evaluateSrdCharacter({
  classes: [{ label: 'Warlock', level: 20 }],
  features: [
    srdFeature({
      owner: 'CLASS',
      classLabel: 'Warlock',
      featureLabel: 'Eldritch Invocations',
      level: 20,
      optionLabels: ['Dreadful Word']
    })
  ]
})

function registryWithPool(poolCode: string): CharacterAssemblyRegistry {
  const feature = srdRegistry.features[invocations.id]!
  const grant = { ...dreadfulWord.spells![0]!, slotCost: { poolCode } }
  return {
    ...srdRegistry,
    features: {
      ...srdRegistry.features,
      [invocations.id]: {
        ...feature,
        options: feature.options!.map((option) =>
          option.id === dreadfulWord.id ? { ...option, spells: [grant] } : option
        )
      }
    }
  }
}

describe('spell slot pool vocabulary', () => {
  it('lists the System pools the dnd5e System defines', () => {
    expect(systemVocabularyRegistry.entries(DND5E_SYSTEM_ID, 'spellSlotPool')).toEqual([
      { code: 'PACT', label: 'Pact Magic' }
    ])
  })

  it('carries a pool code the System defines onto the access candidate', () => {
    const { spellAccessCandidates } = buildCharacterSpellRuleFacts(
      character.snapshot,
      registryWithPool('PACT')
    )
    expect(spellAccessCandidates.some((candidate) => candidate.slotPoolCode === 'PACT')).toBe(true)
  })

  it('refuses a pool code the System does not define', () => {
    expect(() =>
      buildCharacterSpellRuleFacts(character.snapshot, registryWithPool('ARCANE_BOON'))
    ).toThrow('The Game System does not define the spell slot pool "ARCANE_BOON".')
  })
})
