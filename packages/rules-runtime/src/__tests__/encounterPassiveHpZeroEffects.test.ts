import { describe, expect, it } from 'vitest'

import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const discover = (label: string) =>
  discoverEncounterFeatureActions({
    actor: srdCreatureActor({ id: testUuid(0xd101), creature: srdByLabel(SRD.creatures, label) }),
    conditionDefinitionIds: [],
    abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
  })

describe('passive effects that fire at 0 hit points (SPELLS-33.T6e1a)', () => {
  it('lists Balor Death Throes by its trigger, not as an action', () => {
    const found = discover('Balor')
    expect(found.unavailable.filter(({ label }) => label === 'Death Throes')).toEqual([])
    expect(found.passiveHpZeroEffects.map(({ capability }) => capability.label)).toEqual([
      'Death Throes'
    ])
    expect(found.available.map(({ label }) => label)).not.toContain('Death Throes')
  })

  it('lists nothing for a creature without the trigger', () => {
    expect(discover('Goblin').passiveHpZeroEffects).toEqual([])
  })
})
