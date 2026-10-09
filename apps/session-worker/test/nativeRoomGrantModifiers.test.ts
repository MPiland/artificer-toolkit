import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { aidAtSecondLevel } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { longstrider } from '@artificer-toolkit/source-data/srd/spells/longstrider.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-5.6 through the room: a Character's speed grant (Longstrider) widens its movement budget
 * readout,
 * and its maximum hit point grant (Aid) lets it hold more hit points until the grant expires.
 */

const MOVER_ID = testUuid(0x200)
const WOLF_ID = testUuid(0x201)
const CHARACTER_ID = testUuid(0x400)
const MOVER_START = { x: 150, y: 150 }
/** The fixture Character's stored maximum; Aid at 2nd level adds 5. */
const STORED_MAXIMUM = 11

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof movementRoom>>

function grantRoom(seed: Parameters<typeof seedModifierGrant>[0] | null, currentHitPoints = 11) {
  // Initiative reads the Character's frozen identity, which a turn change checks.
  const mover = {
    ...characterActor({ id: MOVER_ID, characterId: CHARACTER_ID }),
    snapshot: { kind: 'CHARACTER' as const, id: CHARACTER_ID, systemId: srdSystemRecord.id }
  }
  return movementRoom({
    actors: [mover, srdCreatureActor({ id: WOLF_ID, creature: reactionWolf })],
    moverActorId: MOVER_ID,
    positions: { [MOVER_ID]: MOVER_START, [WOLF_ID]: { x: 150, y: 850 } },
    characterPlay: { currentHitPoints },
    ...(seed && { seed: seedModifierGrant(seed) })
  })
}

const longstriderGrant = {
  sourceActorId: MOVER_ID,
  holderActorId: MOVER_ID,
  lifecycle: {},
  effect: longstrider.effects?.[0],
  sourceLabel: longstrider.label
}

const characterHitPoints = (room: Room) =>
  runInDurableObject(room.base.stub, (_instance, state) => {
    const row = new RoomEncounterStore(state.storage)
      .documents('characterPlayStates')
      .find((play) => play.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).hitpoints.current
  })

/** The mover's walking budget this turn, as the GM's Encounter session shows it. */
async function moverBudget(room: Room) {
  const first = room.base.messages.length
  room.base.socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false }))
  const state = await vi.waitFor(() => {
    const message = room.base.messages
      .slice(first)
      .find((candidate) => candidate.type === 'ENCOUNTER_SESSION')
    if (message?.type !== 'ENCOUNTER_SESSION' || !message.session.held)
      throw new Error('The room has not sent the held Encounter session.')
    return message.session.state
  })
  return state.turnMovement.find(({ actorId }) => actorId === MOVER_ID)?.budget
}

async function advanceTurn(room: Room) {
  const [run] = (await readRoomHistory(room.base.stub)).runs
  const commandId = crypto.randomUUID()
  const answer = await room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      type: 'ADVANCE_TURN',
      encounterId: room.encounterId,
      commandId,
      expectedVersion: run!.version
    }
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('a speed grant changes the movement budget (SPELLS-5.6)', () => {
  it('widens a Character’s walking budget by Longstrider’s 10 feet', async () => {
    const withGrant = await grantRoom(longstriderGrant)
    expect(await moverBudget(withGrant)).toBe(40)

    const without = await grantRoom(null)
    expect(await moverBudget(without)).toBe(30)
  })
})

describe('a maximum hit point grant (SPELLS-5.6)', () => {
  it('holds hit points above the stored maximum until it expires, then clamps them', async () => {
    const room = await grantRoom(
      {
        sourceActorId: MOVER_ID,
        holderActorId: MOVER_ID,
        lifecycle: { turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' } },
        effect: aidAtSecondLevel(),
        sourceLabel: 'Aid'
      },
      STORED_MAXIMUM + 5
    )
    expect((await readRoomHistory(room.base.stub)).characterEffects).toHaveLength(1)
    expect(await characterHitPoints(room)).toBe(STORED_MAXIMUM + 5)

    await advanceTurn(room)

    expect((await readRoomHistory(room.base.stub)).characterEffects).toEqual([])
    expect(await characterHitPoints(room)).toBe(STORED_MAXIMUM)
  })
})
