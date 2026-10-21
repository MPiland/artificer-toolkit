import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { answerAllSaves } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf } from './placedZoneRoomReads.js'

/**
 * SPELLS-33 T4i1b2: a creature whose regeneration a damage type suppresses takes that damage in a
 * real command, and the room's start-of-turn trait then regenerates or not, turn by turn.
 */

const CASTER_ID = testUuid(0x2360)
const HOLDER_ID = testUuid(0x2361)

afterEach(() => {
  closeTrackedSockets()
})

/** The caster acts first and its area hits the holder at the point; the holder's turn is next. */
function regeneratingRoom(
  damage: 'RADIANT' | 'FIRE',
  creatureLabel: 'Vampire' | 'Troll',
  currentHitPoints: number
) {
  const caster = fireballWolf(damage)
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: caster }),
      srdCreatureActor({
        id: HOLDER_ID,
        creature: srdByLabel(SRD.creatures, creatureLabel),
        currentHitPoints,
        defeated: currentHitPoints === 0
      })
    ],
    ownerFeatureId: caster.features?.find((feature) => feature.label === 'Bite')?.id
  })
}

async function advance(room: Awaited<ReturnType<typeof regeneratingRoom>>) {
  const answer = await room.send({
    type: 'ADVANCE_TURN',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The caster's area hits the holder, who fails its save and takes the 1 damage. */
async function hitHolder(room: Awaited<ReturnType<typeof regeneratingRoom>>) {
  await room.startAreaAction({ x: 50, y: 150 })
  await answerAllSaves(room)
}

describe('damage-type suppression of start-of-turn regeneration in a room (SPELLS-33 T4i1b2)', () => {
  it('a wounded Vampire does not regenerate on the turn after radiant damage, and does on the next', async () => {
    const room = await regeneratingRoom('RADIANT', 'Vampire', 100)
    await hitHolder(room)
    const afterHit = await hitPointsOf(room, HOLDER_ID)
    expect(afterHit).toBeLessThan(100)

    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe(afterHit)

    await advance(room)
    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe((afterHit ?? 0) + 20)
  })

  it('a Troll takes no regeneration after fire damage, and regenerates at 0 hit points on a turn without it', async () => {
    const room = await regeneratingRoom('FIRE', 'Troll', 60)
    await hitHolder(room)
    const afterHit = await hitPointsOf(room, HOLDER_ID)

    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe(afterHit)

    await advance(room)
    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe((afterHit ?? 0) + 10)
  })

  it('a Troll at 0 hit points regenerates on a turn without acid or fire damage', async () => {
    const room = await regeneratingRoom('FIRE', 'Troll', 0)
    await advance(room)
    expect(await hitPointsOf(room, HOLDER_ID)).toBe(10)
  })
})
