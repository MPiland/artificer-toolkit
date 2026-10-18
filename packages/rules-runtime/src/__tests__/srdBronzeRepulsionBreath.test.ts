import { describe, expect, it } from 'vitest'
import { EFFECT_KIND } from '@artificer-toolkit/shared/core'
import { adultBronzeDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-bronze-dragon.js'
import { ancientBronzeDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-bronze-dragon.js'
import { bronzeDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/bronze-dragon-wyrmling.js'
import { youngBronzeDragon } from '@artificer-toolkit/source-data/srd/creatures/young-bronze-dragon.js'

import { installedSrdCreature } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureActor,
  prepareCreatureAction,
  settleCreatureAction
} from './encounterCreatureAction.js'

const DRAGON_ID = '00000000-0000-4000-8000-0000000d5001'
const TARGET_ID = '00000000-0000-4000-8000-0000000d5002'
/** 0-based die faces: a natural 1 and a natural 20. */
const FAILED = 0
const SAVED = 19

/** The dragon with only its SRD Repulsion Breath, the breath Effect that pushes. */
function repulsionBreather(raw: typeof bronzeDragonWyrmling) {
  const creature = installedSrdCreature(raw)
  const feature = creature.features.find(({ effects }) =>
    effects?.some(({ paths }) =>
      paths.some(
        (path) =>
          'resultBlock' in path &&
          path.resultBlock.outcomes.some(
            ({ effectKind }) => effectKind === EFFECT_KIND.FORCED_MOVEMENT
          )
      )
    )
  )
  if (!feature) throw new Error(`${creature.label} has no Repulsion Breath.`)
  const effects = feature.effects?.filter(({ paths }) =>
    paths.some(
      (path) =>
        'resultBlock' in path &&
        path.resultBlock.outcomes.some(
          ({ effectKind }) => effectKind === EFFECT_KIND.FORCED_MOVEMENT
        )
    )
  )
  return {
    featureId: feature.id,
    actor: creatureActor({
      id: DRAGON_ID,
      label: creature.label,
      statBlock: creature,
      features: [{ ...feature, effects }]
    })
  }
}

async function breatheOn(raw: typeof bronzeDragonWyrmling, face: number) {
  const { actor, featureId } = repulsionBreather(raw)
  const prepared = await prepareCreatureAction({
    actor,
    // Strength 29 (+9), so a natural 20 makes even the Ancient's DC 24 and a natural 1 fails a DC 12.
    target: creatureActor({
      id: TARGET_ID,
      label: 'Target',
      statBlock: installedSrdCreature(ancientBronzeDragon),
      features: []
    }),
    featureId,
    overridable: false
  })
  const { execution } = await settleCreatureAction({ prepared, rolls: [face] })
  return (
    prepared.adapter.interpretSpatial?.({
      execution: execution.execution,
      occurrenceId: '00000000-0000-4000-8000-00000000e007',
      published: execution.published,
      targetActorId: TARGET_ID
    }) ?? []
  )
}

// SPELLS-19.T4: the SRD prints each age's push: "pushed 30 feet away from the dragon" (wyrmling),
// 40 (young), 60 (adult and ancient).
describe.each([
  { creature: bronzeDragonWyrmling, feet: 30 },
  { creature: youngBronzeDragon, feet: 40 },
  { creature: adultBronzeDragon, feet: 60 },
  { creature: ancientBronzeDragon, feet: 60 }
])('the SRD $creature.label’s Repulsion Breath', ({ creature, feet }) => {
  it(`pushes a creature that fails its save ${feet} feet away from the dragon`, async () => {
    expect(await breatheOn(creature, FAILED)).toEqual([
      expect.objectContaining({
        kind: 'FORCED_MOVEMENT',
        targetActorId: TARGET_ID,
        direction: 'AWAY_FROM_SOURCE',
        feet
      })
    ])
  })

  it('does not push a creature that succeeds', async () => {
    expect(await breatheOn(creature, SAVED)).toEqual([])
  })
})
