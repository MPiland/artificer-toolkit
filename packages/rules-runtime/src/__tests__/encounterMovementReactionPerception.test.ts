import { describe, expect, it } from 'vitest'

import { createEncounterMovementReactionPerception } from '../encounterMovementReactionPerception.js'
import {
  creatureActor,
  creatureEncounter,
  srdAttackPerceptionLoaders
} from './encounterCreatureAction.js'
import { brightZoneScene, darknessZone, ZONE_GRID, zoneToken } from './spatialZoneFixture.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

const REACTOR_ID = testUuid(0xe1)
const MOVER_ID = testUuid(0xe2)

/**
 * Whether a senseless reactor at x 850 still sees a mover the moment it reaches `contactX` on the
 * zone's row, when a radius-50 zone of darkness lies at x 150 (spanning x 100 to 200).
 */
async function reactorSeesMoverAt(contactX: number) {
  const reactor = creatureActor({ id: REACTOR_ID, label: 'Reactor', features: [] })
  const mover = creatureActor({ id: MOVER_ID, label: 'Mover', features: [] })
  const { state, movementTargets } = creatureEncounter([reactor, mover])
  const reactorToken = zoneToken(testUuid(0xe3), 'Reactor', 850)
  const moverToken = zoneToken(testUuid(0xe4), 'Mover', 450)
  const { loadDefinition, loadSystem } = srdAttackPerceptionLoaders()
  const sees = await createEncounterMovementReactionPerception({
    loadDefinition,
    loadSystem,
    state,
    actors: [reactor, mover],
    targets: movementTargets,
    movingTokenId: moverToken.id,
    actorIdByTokenId: new Map([
      [reactorToken.id, REACTOR_ID],
      [moverToken.id, MOVER_ID]
    ]),
    sceneId: testUuid(0xe5),
    sceneVersion: 1,
    sceneGrid: ZONE_GRID,
    scene: brightZoneScene([reactorToken, moverToken]),
    loadSpatialEffects: async () => [darknessZone({ x: 150, y: 50 })]
  })
  return sees({
    source: {
      reactorActorId: REACTOR_ID,
      reactorTokenId: reactorToken.id,
      source: { binding: { perceptionRequirement: 'SEE' } }
    },
    candidate: {
      reactorActorId: REACTOR_ID,
      reactorTokenId: reactorToken.id,
      movingActorId: MOVER_ID,
      contact: { x: contactX, y: 50 }
    }
  } as unknown as Parameters<typeof sees>[0])
}

describe('movement reaction perception through a lasting zone (SPELLS-24)', () => {
  it('is not affected by a zone the mover footprint only touches at the contact', async () => {
    // At x 50 the mover spans x 0 to 100 and shares only the zone's left edge.
    expect(await reactorSeesMoverAt(50)).toBe(true)
  })

  it('is affected by a zone the mover footprint overlaps at the contact', async () => {
    // At x 60 the mover spans x 10 to 110 and shares a strip of the zone.
    expect(await reactorSeesMoverAt(60)).toBe(false)
  })
})
