import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { castChoiceOptions, pickedCastChoiceEffect } from '../encounterCastChoice.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const SPAWN_ID = testUuid(0xc1)

/** The Vampire Spawn's Claws, discovered with `targeting` replaced when given. */
function discoveredClaws(targeting?: { selectionKind: 'SELF' }) {
  const spawn = srdByLabel(SRD.creatures, 'Vampire Spawn')
  const claws = creatureFeature(spawn, 'Claws')
  const creature = {
    ...spawn,
    features: spawn.features?.map((feature) =>
      feature.id === claws.id && targeting
        ? {
            ...feature,
            effects: feature.effects?.map((effect) => ({
              ...effect,
              invocation: {
                ...effect.invocation,
                targeting: { ...effect.invocation.targeting, ...targeting }
              }
            }))
          }
        : feature
    )
  }
  const discovery = discoverEncounterFeatureActions({
    spells: new Map(),
    actor: srdCreatureActor({ id: SPAWN_ID, creature }),
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
  })
  return {
    capability: discovery.available.find((entry) => entry.ownerFeatureId === claws.id),
    unavailable: discovery.unavailable.find((entry) => entry.ownerFeatureId === claws.id)
  }
}

describe('Creature discovery compiles a cast pick per option (SPELLS-33.T3a6, D148)', () => {
  it('lists the Claws as an available action whose options are damage and grapple', () => {
    const { capability, unavailable } = discoveredClaws()
    expect(unavailable).toBeUndefined()
    expect(castChoiceOptions(capability!.compiledEffect)?.map((option) => option.label)).toEqual([
      'Damage',
      'Grapple'
    ])
  })

  it('makes only the Claws unavailable when their shape cannot be run, and leaves the rest (D54)', () => {
    const { capability, unavailable } = discoveredClaws({ selectionKind: 'SELF' })
    expect(capability).toBeUndefined()
    expect(unavailable?.reason).toBeTruthy()
  })

  it('runs the first authored option of a pick a no-prompt flow (a Legendary Action) cannot ask for', () => {
    const { compiledEffect } = discoveredClaws().capability!
    const options = castChoiceOptions(compiledEffect)!
    expect(pickedCastChoiceEffect(compiledEffect, undefined, [], true)).toEqual(
      options[0]!.compiledEffect
    )
    expect(() => pickedCastChoiceEffect(compiledEffect, undefined, [])).toThrow()
  })
})
