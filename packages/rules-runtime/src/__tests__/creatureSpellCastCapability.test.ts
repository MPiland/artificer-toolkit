import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { discoverEncounterFeatureActionCapabilities } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { SRD, srdByLabel } from './dnd5eSrdCharacter.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const LICH_ID = testUuid(0xe1)
const SPELL_ID = testUuid(0xe2)

/** The Lich's Paralyzing Touch (a spell attack), discovered with the given `spellCast` authored on it. */
function paralyzingTouch(spellCast?: { spellId: string } | { castLevel: number }) {
  const lich = srdByLabel(SRD.creatures, 'Lich')
  const touch = creatureFeature(lich, 'Paralyzing Touch')
  const creature = {
    ...lich,
    features: lich.features?.map((feature) =>
      feature.id === touch.id
        ? {
            ...feature,
            effects: feature.effects?.map((effect) =>
              effect.invocation.kind === 'ACTION' ? { ...effect, spellCast } : effect
            )
          }
        : feature
    )
  }
  const capability = discoverEncounterFeatureActionCapabilities({
    actor: srdCreatureActor({ id: LICH_ID, creature }),
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
  }).find((entry) => entry.ownerFeatureId === touch.id)
  if (!capability) throw new Error('Paralyzing Touch was not discovered.')
  return capability
}

describe('Creature capability spellCast (REACTION-4.T3h)', () => {
  it('carries an authored cast level onto the discovered capability', () => {
    expect(paralyzingTouch({ castLevel: 4 }).spellCast).toEqual({ castLevel: 4 })
  })

  it('carries a referenced System spell onto the discovered capability', () => {
    expect(paralyzingTouch({ spellId: SPELL_ID }).spellCast).toEqual({ spellId: SPELL_ID })
  })

  it('has no cast on a capability that casts no spell, a spell attack included', () => {
    expect(paralyzingTouch().spellCast).toBeNull()
  })
})
