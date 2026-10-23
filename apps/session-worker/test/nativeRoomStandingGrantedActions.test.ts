import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { grantedActionId } from '@artificer-toolkit/rules-runtime/encounterGrantedActions'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-33.T4l1 (D160): a Creature trait with a grant that has no duration offers its basic actions
 * on every turn (Goblin's Nimble Escape), and a Creature's own timed grant offers an extra weapon
 * attack (Clay Golem's Haste), both through the real RESOLVE_ACTION command of the local room.
 */

const GOBLIN_ID = testUuid(0xc40)
const GOLEM_ID = testUuid(0xc41)
const WOLF_ID = testUuid(0xc42)

const goblin = srdByLabel(SRD.creatures, 'Goblin')
const clayGolem = srdByLabel(SRD.creatures, 'Clay Golem')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const disengageOf = (actorId: string) => {
  const disengage = SRD_BASIC_ACTION_DEFINITIONS.find(
    ({ id }) => id === SRD_BASIC_ACTION_IDS.DISENGAGE
  )
  if (disengage?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Disengage.')
  return encounterBasicActionId(
    actorId,
    SRD_BASIC_ACTION_IDS.DISENGAGE,
    disengage.document.effects[0]!.id
  )
}

describe('room Goblin Nimble Escape (SPELLS-33.T4l1)', () => {
  it('lets the goblin Disengage as a Bonus Action on each of its turns', async () => {
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: GOBLIN_ID, creature: goblin }),
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      ownerFeatureId: creatureFeature(goblin, 'Scimitar').id
    })
    const nimbleEscapeId = creatureFeature(goblin, 'Nimble Escape').effects![0]!.id
    const offered = grantedActionId(disengageOf(GOBLIN_ID), nimbleEscapeId, 0)
    const disengage = () => room.startAction(GOBLIN_ID, [], null, null, offered, GOBLIN_ID)

    const first = await disengage()
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    // The offer charges the turn's Bonus Action, which is now spent.
    const again = await disengage()
    expect(again.answer.type, JSON.stringify(again.answer)).not.toBe('COMMAND_COMMITTED')

    for (let turn = 0; turn < 2; turn += 1) await room.advanceTurn()
    const next = await disengage()
    expect(next.answer.type, JSON.stringify(next.answer)).toBe('COMMAND_COMMITTED')
  }, 120000)
})

describe('room Clay Golem Haste (SPELLS-33.T4l1)', () => {
  it('lets the hasted golem make one more slam in the turn it spent its Action', async () => {
    const golem = srdCreatureActor({ id: GOLEM_ID, creature: clayGolem })
    const hasteFeatureId = creatureFeature(clayGolem, 'Haste (Recharge 5-6)').id
    const room = await actionRoom({
      actors: [golem, srdCreatureActor({ id: WOLF_ID, creature: plainWolf })],
      ownerFeatureId: hasteFeatureId
    })
    const slamId = room.featureActionId(golem, creatureFeature(clayGolem, 'Slam').id)
    const slam = () => room.startAction(WOLF_ID, [], null, null, slamId, GOLEM_ID)

    const haste = await room.startAction(GOLEM_ID)
    expect(haste.answer.type, JSON.stringify(haste.answer)).toBe('COMMAND_COMMITTED')

    // Haste spent the Action, so the slam is charged to the granted attack, once a turn.
    const first = await slam()
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    const second = await slam()
    expect(second.answer.type, JSON.stringify(second.answer)).not.toBe('COMMAND_COMMITTED')
  }, 120000)
})
