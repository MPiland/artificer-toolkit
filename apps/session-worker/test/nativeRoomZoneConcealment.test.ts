import {
  carryingZone,
  environmentalZones
} from '@artificer-toolkit/rules-runtime/testing/authoredZoneFixture'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { ZoneDcDto } from '@artificer-toolkit/schema/shared/spatial'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import { readZones, revertLastAction, walkerMoves } from './placedZoneRoomReads.js'

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

const seated = (id: string, characterId: string) => ({
  ...characterActor({ id, characterId }),
  snapshot: { kind: 'CHARACTER', id: characterId, systemId: srdSystemRecord.id }
})

/** A room whose player's Character carries an item leaving a caltrop field; another player's Wolf. */
function concealmentRoom(zone: Parameters<typeof carryingZone>[0] = caltropField) {
  const item = carryingZone(zone)
  return actionRoom({
    actors: [
      seated(SPREADER_ACTOR_ID, SPREADER_ID),
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

type Member = {
  messages: LiveSessionWebSocketServerMessageDto[]
  socket: { send(data: string): void }
}

/** The held Encounter session state the room's session frame sends this member. */
async function sessionShownTo(client: Member) {
  const first = client.messages.length
  client.socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false }))
  return vi.waitFor(() => {
    const message = client.messages
      .slice(first)
      .find((candidate) => candidate.type === 'ENCOUNTER_SESSION')
    if (message?.type !== 'ENCOUNTER_SESSION' || !message.session.held)
      throw new Error('The room has not sent the held Encounter session.')
    return message.session.state
  })
}

/** The placed zones and careful-crossing fields the room's session frame shows this member. */
async function zonesShownTo(client: Member) {
  const { placedZones, halfSpeedFields } = await sessionShownTo(client)
  return { placedZones, halfSpeedFields: halfSpeedFields.map(({ id }) => id) }
}

async function setDcs(room: Room, spatialEffectId: string, spotDc: ZoneDcDto = SPOT_DC) {
  return room.send({
    type: 'SET_ZONE_DCS',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    spatialEffectId,
    spotDc,
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

const NOTICER_ACTOR_ID = testUuid(0x3c03)
const NOTICER_ID = testUuid(0x3c04)
/** Every SRD Character's passive Perception meets the low DC and none meets the high one. */
const LOW_SPOT_DC = { value: 1, source: 'FLAT' as const }
const HIGH_SPOT_DC = { value: 30, source: 'FLAT' as const }

/**
 * MOVE-3.5: a Character whose passive Perception meets a concealed zone's spot DC and who sees the
 * zone prompts the GM. The spreader's Character and a second player's Character, the noticer;
 * `walled` puts a wall between the noticer and the zone.
 */
function noticingRoom(options: { zoneNoticing?: 'SEARCH_ONLY'; walled?: boolean } = {}) {
  const item = carryingZone(caltropField)
  return actionRoom({
    actors: [
      seated(SPREADER_ACTOR_ID, SPREADER_ID),
      seated(NOTICER_ACTOR_ID, NOTICER_ID),
      srdCreatureActor({ id: WALKER_ID, creature: plainWolf })
    ],
    positions: { [NOTICER_ACTOR_ID]: { x: 650, y: 150 }, [WALKER_ID]: { x: 450, y: 350 } },
    secondCharacter: { characterId: NOTICER_ID },
    characterEquipment: [item],
    characterAction: (action) => action.label === item.label,
    playerControlledActorIds: [SPREADER_ACTOR_ID],
    otherPlayerControlledActorIds: [NOTICER_ACTOR_ID],
    autoRoll: 'EVERYONE',
    zoneNoticing: options.zoneNoticing,
    ...(options.walled && {
      sceneOverrides: {
        barriers: [
          {
            id: testUuid(0x3c05),
            kind: 'WALL' as const,
            a: { x: 500, y: 50 },
            b: { x: 500, y: 250 },
            blocksLight: true,
            blocksMovement: true
          }
        ]
      }
    })
  })
}

function placePitCommand(room: Room, spotDc: typeof LOW_SPOT_DC, expectedVersion: number) {
  return {
    type: 'PLACE_ZONE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion,
    zone: pit,
    point: FIELD_POINT,
    spotDc
  }
}

async function placePit(room: Room, spotDc: typeof LOW_SPOT_DC) {
  const placed = await room.send(placePitCommand(room, spotDc, await room.version()))
  expect(placed.type, JSON.stringify(placed)).toBe('COMMAND_COMMITTED')
  const [zone] = await readZones(room)
  return zone!.id
}

async function sightingsShownTo(client: Member) {
  return (await sessionShownTo(client)).pendingZoneSightings
}

describe('noticing a concealed zone (MOVE-3.5)', () => {
  it('prompts the GM, once, for each Character in sight that meets the spot DC, and no player', async () => {
    const room = await noticingRoom()
    const command = placePitCommand(room, LOW_SPOT_DC, await room.version())
    const placed = await room.send(command)
    expect(placed.type, JSON.stringify(placed)).toBe('COMMAND_COMMITTED')
    const [zone] = await readZones(room)
    const both = [
      { spatialEffectId: zone!.id, actorId: SPREADER_ACTOR_ID },
      { spatialEffectId: zone!.id, actorId: NOTICER_ACTOR_ID }
    ]

    expect(await sightingsShownTo(room.room.base)).toEqual(both)
    const other = await connectPlayer(room.room.base, 'OTHER_PLAYER')
    expect(await sightingsShownTo(await connectPlayer(room.room.base, 'PLAYER'))).toEqual([])
    expect(await sightingsShownTo(other)).toEqual([])
    // A sighting reveals nothing to its player until the GM reveals the zone (MOVE-3.7).
    expect((await zonesShownTo(other)).placedZones).toEqual([])

    // The replayed command adds no zone and no sighting.
    const replayed = await room.send(command)
    expect(replayed.type, JSON.stringify(replayed)).toBe('COMMAND_COMMITTED')
    expect(await readZones(room)).toHaveLength(1)
    expect(await sightingsShownTo(room.room.base)).toEqual(both)
  })

  it('prompts no one when no passive meets the spot DC or the Campaign notices by Search only', async () => {
    const unmet = await noticingRoom()
    await placePit(unmet, HIGH_SPOT_DC)
    expect(await sightingsShownTo(unmet.room.base)).toEqual([])

    const searchOnly = await noticingRoom({ zoneNoticing: 'SEARCH_ONLY' })
    await placePit(searchOnly, LOW_SPOT_DC)
    expect(await sightingsShownTo(searchOnly.room.base)).toEqual([])
  })

  it('prompts the GM when a move brings a Character into sight of the zone', async () => {
    const room = await noticingRoom({ walled: true })
    const zoneId = await placePit(room, LOW_SPOT_DC)
    expect(await sightingsShownTo(room.room.base)).toEqual([
      { spatialEffectId: zoneId, actorId: SPREADER_ACTOR_ID }
    ])

    const noticerToken = room.room.scene.tokens.findIndex(
      (token) => token.id === `f${NOTICER_ACTOR_ID.slice(1)}`
    )
    await walkerMoves(room, [{ x: 650, y: 350 }], false, noticerToken)

    expect(await sightingsShownTo(room.room.base)).toEqual([
      { spatialEffectId: zoneId, actorId: SPREADER_ACTOR_ID },
      { spatialEffectId: zoneId, actorId: NOTICER_ACTOR_ID }
    ])
  })

  it('lets the GM dismiss a sighting, which undo prompts again', async () => {
    const room = await noticingRoom()
    const zoneId = await placePit(room, LOW_SPOT_DC)
    const dismiss = async () =>
      room.send({
        type: 'DISMISS_ZONE_SIGHTING',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version(),
        spatialEffectId: zoneId,
        actorId: NOTICER_ACTOR_ID
      })
    const dismissed = await dismiss()
    expect(dismissed.type, JSON.stringify(dismissed)).toBe('COMMAND_COMMITTED')
    expect(await sightingsShownTo(room.room.base)).toEqual([
      { spatialEffectId: zoneId, actorId: SPREADER_ACTOR_ID }
    ])
    expect(await dismiss()).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })

    await revertLastAction(room)

    expect(await sightingsShownTo(room.room.base)).toEqual([
      { spatialEffectId: zoneId, actorId: SPREADER_ACTOR_ID },
      { spatialEffectId: zoneId, actorId: NOTICER_ACTOR_ID }
    ])
  })

  it('still undoes the GM spot DC after a Character noticed the zone', async () => {
    const room = await noticingRoom()
    const { answer } = await room.startAreaAction(FIELD_POINT)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const [zone] = await readZones(room)
    const set = await setDcs(room, zone!.id, LOW_SPOT_DC)
    expect(set.type, JSON.stringify(set)).toBe('COMMAND_COMMITTED')
    // The placer knows of its own field; only the noticer sights it.
    expect(await sightingsShownTo(room.room.base)).toEqual([
      { spatialEffectId: zone!.id, actorId: NOTICER_ACTOR_ID }
    ])

    await revertLastAction(room)

    expect(await sightingsShownTo(room.room.base)).toEqual([])
    expect(await zonesShownTo(await connectPlayer(room.room.base, 'OTHER_PLAYER'))).toEqual({
      placedZones: [expect.objectContaining({ id: zone!.id, spotDc: null })],
      halfSpeedFields: [zone!.id]
    })
  })
})
