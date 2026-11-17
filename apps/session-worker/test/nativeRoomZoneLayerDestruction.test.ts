import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { layeredZoneSpell } from '@artificer-toolkit/rules-runtime/testing/layeredZoneSpell'
import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import { choiceOptionIdOf, readZones, revertLastAction } from './placedZoneRoomReads.js'

/**
 * QUALITY-15.T3v2 (D223): the GM destroys a layered zone's layers by command, through a real room.
 * Each layer carries what its component authors destroys it; the GM's session lists that text, the
 * layers fall only in order, a destroyed layer stays gone, and undo puts it back.
 */

const CASTER_ACTOR_ID = testUuid(0x2590)
const CASTER_ID = testUuid(0x2591)
const BEAR_ID = testUuid(0x2592)

const SPELL = layeredZoneSpell()
const CENTER = { x: 600, y: 600 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof layeredRoom>>

type Member = {
  messages: LiveSessionWebSocketServerMessageDto[]
  socket: { send(data: string): void }
}

function layeredRoom() {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: BEAR_ID, creature: brownBear })
    ],
    positions: { [BEAR_ID]: { x: 1000, y: 600 } },
    characterSpellcasting: { spells: [SPELL], prepared: [SPELL.id] },
    characterAction: (action) => action.label === 'Layered Ward (9th level)',
    autoRoll: 'EVERYONE'
  })
}

/** The cast's layer records, first layer first. */
async function castLayers(room: Room) {
  const { answer } = await room.startAreaCommand({
    kind: 'POINT',
    point: CENTER,
    choiceOptionId: choiceOptionIdOf(SPELL, 'Sphere')
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return (await readZones(room)).sort(
    (left, right) => (left.placement.layerIndex ?? 0) - (right.placement.layerIndex ?? 0)
  )
}

async function destroyLayer(room: Room, spatialEffectId: string) {
  return room.send({
    type: 'DESTROY_ZONE_LAYER',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    spatialEffectId
  })
}

/** Each placed zone's destruction, as the room's session frame shows it to this member. */
async function destructionShownTo(client: Member) {
  const first = client.messages.length
  client.socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false }))
  const state = await vi.waitFor(() => {
    const message = client.messages
      .slice(first)
      .find((candidate) => candidate.type === 'ENCOUNTER_SESSION')
    if (message?.type !== 'ENCOUNTER_SESSION' || !message.session.held)
      throw new Error('The room has not sent the held Encounter session.')
    return message.session.state
  })
  return Object.fromEntries(state.placedZones.map(({ id, destruction }) => [id, destruction]))
}

describe('the GM destroys a layered zone one layer at a time (QUALITY-15.T3v2, D223)', () => {
  it('shows each layer’s authored criteria to the GM only, the first layer as next', async () => {
    const room = await layeredRoom()
    const [red, orange, yellow] = await castLayers(room)

    expect(await destructionShownTo(room.room.base)).toEqual({
      [red!.id]: { next: true, criteria: ['25 or more Cold damage'] },
      [orange!.id]: { next: false, criteria: ['A strong wind'] },
      [yellow!.id]: { next: false, criteria: ['60 or more Force damage'] }
    })
    expect(await destructionShownTo(await connectPlayer(room.room.base))).toEqual({
      [red!.id]: null,
      [orange!.id]: null,
      [yellow!.id]: null
    })
  })

  it('destroys the layers in order, refuses one out of order, and keeps a destroyed layer gone', async () => {
    const room = await layeredRoom()
    const [red, orange, yellow] = await castLayers(room)

    expect(await destroyLayer(room, orange!.id)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
    expect((await readZones(room)).map(({ id }) => id).sort()).toEqual(
      [red!.id, orange!.id, yellow!.id].sort()
    )

    const destroyed = await destroyLayer(room, red!.id)
    expect(destroyed.type, JSON.stringify(destroyed)).toBe('COMMAND_COMMITTED')
    expect((await readZones(room)).map(({ id }) => id).sort()).toEqual(
      [orange!.id, yellow!.id].sort()
    )
    expect(await destroyLayer(room, red!.id)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
    // The next layer is now the first that remains; the one after it still waits.
    expect(await destructionShownTo(room.room.base)).toEqual({
      [orange!.id]: { next: true, criteria: ['A strong wind'] },
      [yellow!.id]: { next: false, criteria: ['60 or more Force damage'] }
    })
    // A destroyed layer stays destroyed as turns pass.
    await room.advanceTurn()
    await room.advanceTurn()
    expect((await readZones(room)).map(({ id }) => id)).not.toContain(red!.id)

    const next = await destroyLayer(room, orange!.id)
    expect(next.type, JSON.stringify(next)).toBe('COMMAND_COMMITTED')
    expect((await readZones(room)).map(({ id }) => id)).toEqual([yellow!.id])
  })

  it('undoes a destroyed layer: it returns whole, and is next again', async () => {
    const room = await layeredRoom()
    const [red, orange, yellow] = await castLayers(room)
    const destroyed = await destroyLayer(room, red!.id)
    expect(destroyed.type, JSON.stringify(destroyed)).toBe('COMMAND_COMMITTED')

    await revertLastAction(room)

    const restored = (await readZones(room)).find(({ id }) => id === red!.id)
    expect(restored).toMatchObject({
      placement: red!.placement,
      spatialState: red!.spatialState,
      lifecycle: red!.lifecycle
    })
    expect(await destructionShownTo(room.room.base)).toEqual({
      [red!.id]: { next: true, criteria: ['25 or more Cold damage'] },
      [orange!.id]: { next: false, criteria: ['A strong wind'] },
      [yellow!.id]: { next: false, criteria: ['60 or more Force damage'] }
    })
    expect(await destroyLayer(room, orange!.id)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
  })
})
