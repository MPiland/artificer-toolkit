import {
  carryingZone,
  environmentalZones
} from '@artificer-toolkit/rules-runtime/testing/authoredZoneFixture'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import { readZones, revertLastAction } from './placedZoneRoomReads.js'

/**
 * MOVE-3.3: a placed zone with a spot DC is concealed. The room's session frame draws and lists it
 * only for the GM and the players whose Characters know of it, and only the GM reads its DCs. The
 * SRD caltrop field a Character leaves, and a pit the GM places, are the fixtures.
 */

const SPREADER_ACTOR_ID = testUuid(0x3c00)
const SPREADER_ID = testUuid(0x3c01)
const WALKER_ID = testUuid(0x3c02)

const FIELD_POINT = { x: 250, y: 150 }
const { caltropField, pit } = environmentalZones()
const SPOT_DC = { value: 14, source: 'PLACER_ROLL' as const }
const DISARM_DC = { value: 12, source: 'FLAT' as const }
const CAMOUFLAGE = { spotDc: { kind: 'FIXED' as const, value: 11 } }
const CAMOUFLAGE_SPOT_DC = { value: 11, source: 'FLAT' as const }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A room whose player's Character carries an item leaving a caltrop field; another player's Wolf. */
function concealmentRoom(zone: Parameters<typeof carryingZone>[0] = caltropField) {
  const item = carryingZone(zone)
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: SPREADER_ACTOR_ID, characterId: SPREADER_ID }),
        snapshot: { kind: 'CHARACTER', id: SPREADER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WALKER_ID, creature: plainWolf })
    ],
    positions: { [WALKER_ID]: { x: 450, y: 150 } },
    characterEquipment: [item],
    characterAction: (action) => action.label === item.label,
    playerControlledActorIds: [SPREADER_ACTOR_ID],
    otherPlayerControlledActorIds: [WALKER_ID],
    autoRoll: 'EVERYONE'
  })
}

type Room = Awaited<ReturnType<typeof concealmentRoom>>

/** The placed zones and careful-crossing fields the room's session frame shows this member. */
async function zonesShownTo(client: {
  messages: LiveSessionWebSocketServerMessageDto[]
  socket: { send(data: string): void }
}) {
  const first = client.messages.length
  client.socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false }))
  return vi.waitFor(() => {
    const message = client.messages
      .slice(first)
      .find((candidate) => candidate.type === 'ENCOUNTER_SESSION')
    if (message?.type !== 'ENCOUNTER_SESSION' || !message.session.held)
      throw new Error('The room has not sent the held Encounter session.')
    const { placedZones, halfSpeedFields } = message.session.state
    return { placedZones, halfSpeedFields: halfSpeedFields.map(({ id }) => id) }
  })
}

async function setDcs(room: Room, spatialEffectId: string) {
  return room.send({
    type: 'SET_ZONE_DCS',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    spatialEffectId,
    spotDc: SPOT_DC,
    disarmDc: DISARM_DC
  })
}

describe('a concealed zone on the Scene (MOVE-3.3)', () => {
  it('shows the zone to the GM with its DCs, to the placer without them, and to no one else', async () => {
    const room = await concealmentRoom()
    const { answer } = await room.startAreaAction(FIELD_POINT)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const [zone] = await readZones(room)
    const placer = await connectPlayer(room.room.base, 'PLAYER')
    const other = await connectPlayer(room.room.base, 'OTHER_PLAYER')
    const inPlainSight = {
      placedZones: [expect.objectContaining({ id: zone!.id, spotDc: null, disarmDc: null })],
      halfSpeedFields: [zone!.id]
    }
    expect(await zonesShownTo(other)).toEqual(inPlainSight)

    const set = await setDcs(room, zone!.id)
    expect(set.type, JSON.stringify(set)).toBe('COMMAND_COMMITTED')

    expect(await zonesShownTo(room.room.base)).toEqual({
      placedZones: [
        expect.objectContaining({ id: zone!.id, spotDc: SPOT_DC, disarmDc: DISARM_DC })
      ],
      halfSpeedFields: [zone!.id]
    })
    expect(await zonesShownTo(placer)).toEqual(inPlainSight)
    expect(await zonesShownTo(other)).toEqual({ placedZones: [], halfSpeedFields: [] })
    expect(await setDcs(room, zone!.id)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })

    await revertLastAction(room)

    expect(await zonesShownTo(other)).toEqual(inPlainSight)
  })

  it('conceals a zone the GM places with a spot DC from every player', async () => {
    const room = await concealmentRoom()
    const placed = await room.send({
      type: 'PLACE_ZONE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      zone: pit,
      point: FIELD_POINT,
      spotDc: SPOT_DC
    })
    expect(placed.type, JSON.stringify(placed)).toBe('COMMAND_COMMITTED')
    const [zone] = await readZones(room)

    expect((await zonesShownTo(room.room.base)).placedZones).toEqual([
      expect.objectContaining({ id: zone!.id, spotDc: SPOT_DC, disarmDc: null })
    ])
    expect((await zonesShownTo(await connectPlayer(room.room.base))).placedZones).toEqual([])
  })

  it('conceals a zone its manifest camouflages the moment a Character places it', async () => {
    const room = await concealmentRoom({ ...caltropField, camouflage: CAMOUFLAGE })
    const { answer } = await room.startAreaAction(FIELD_POINT)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const [zone] = await readZones(room)
    const placer = await connectPlayer(room.room.base, 'PLAYER')
    const other = await connectPlayer(room.room.base, 'OTHER_PLAYER')

    expect(await zonesShownTo(room.room.base)).toEqual({
      placedZones: [
        expect.objectContaining({ id: zone!.id, spotDc: CAMOUFLAGE_SPOT_DC, disarmDc: null })
      ],
      halfSpeedFields: [zone!.id]
    })
    expect((await zonesShownTo(placer)).placedZones).toEqual([
      expect.objectContaining({ id: zone!.id, spotDc: null })
    ])
    expect(await zonesShownTo(other)).toEqual({ placedZones: [], halfSpeedFields: [] })
  })

  it('conceals a camouflaged zone the GM places, under the GM’s own spot DC when typed', async () => {
    const room = await concealmentRoom()
    const camouflagedPit = { ...pit, camouflage: CAMOUFLAGE }
    const place = async (spotDc?: typeof SPOT_DC) =>
      room.send({
        type: 'PLACE_ZONE',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version(),
        zone: camouflagedPit,
        point: FIELD_POINT,
        ...(spotDc ? { spotDc } : {})
      })
    expect((await place()).type).toBe('COMMAND_COMMITTED')
    expect((await place(SPOT_DC)).type).toBe('COMMAND_COMMITTED')

    const gmView = (await zonesShownTo(room.room.base)).placedZones
    expect(gmView.map(({ spotDc }) => spotDc)).toEqual([CAMOUFLAGE_SPOT_DC, SPOT_DC])
    expect((await zonesShownTo(await connectPlayer(room.room.base))).placedZones).toEqual([])
  })
})
