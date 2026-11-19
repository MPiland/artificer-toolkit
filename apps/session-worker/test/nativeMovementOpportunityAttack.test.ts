import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { SRD_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/movementReaction.js'
import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * MOVE-1.T1b (D231): a published SRD Wolf, with no reaction authored on it, makes the System's
 * opportunity attack with its Bite when a hostile creature leaves its reach, and spends its reaction.
 */

const MOVER_ID = testUuid(0x7c01)
const REACTOR_ID = testUuid(0x7c02)

const START: ScenePoint = { x: 150, y: 150 }
const DESTINATION: ScenePoint = { x: 600, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const reactor = srdCreatureActor({ id: REACTOR_ID, creature: plainWolf, disposition: 'FRIENDLY' })
const bite = discoverEncounterFeatureActionCapabilities({
  spells: new Map(),
  actor: reactor,
  conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
  abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
}).find((entry) => entry.ownerFeatureId === creatureFeature(plainWolf, 'Bite').id)

/**
 * A FRIENDLY SRD Wolf stands on a HOSTILE one that walks east out of its reach; the GM's dice are
 * rolled for it. The Bite draws an attack d20 (a 15, which hits) and two bite dice (the minimum).
 */
function opportunityRoom() {
  return movementRoom({
    actors: [reactor, srdCreatureActor({ id: MOVER_ID, creature: plainWolf })],
    moverActorId: MOVER_ID,
    positions: { [REACTOR_ID]: START, [MOVER_ID]: START },
    playerControlledActorIds: [],
    autoRoll: 'GAME_MASTER',
    rolls: [14, 0, 0, 14],
    fallbackRoll: 0,
    spatialEffects: []
  })
}

describe('the System opportunity attack at a Scene move (D231)', () => {
  it('is offered with an unpatched Wolf’s Bite and spends the Wolf’s reaction', async () => {
    if (!bite) throw new Error('The Wolf’s Bite was not discovered.')
    const room = await opportunityRoom()
    const history = await readRoomHistory(room.base.stub)
    const before = readActorHitPoints(history, MOVER_ID)

    const moved = await room.move([START, DESTINATION])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    const used = await room.useReaction()

    expect(used.option).toMatchObject({
      actionId: bite.actionId,
      candidate: { reactorActorId: REACTOR_ID },
      binding: { eligibilityDefinitionId: SRD_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID }
    })
    expect(used.answer.type, JSON.stringify(used.answer)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.base.stub)
    expect(
      after.commands.filter(({ commandId }) => commandId === used.childCommandId)
    ).toMatchObject([{ commandType: 'RESOLVE_ACTION' }])
    expect(readActorHitPoints(after, MOVER_ID)).toBeLessThan(before)
    const reactorRow = after.actors.find(({ id }) => id === REACTOR_ID)
    if (!reactorRow) throw new Error('The room holds no reactor.')
    expect(
      encounterRuleUsageUsed(readStoredRunActor(reactorRow), DND5E_REACTION_ALLOWANCE_DEFINITION_ID)
    ).toBe(1)
  }, 60_000)
})
