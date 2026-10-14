import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import {
  CONCENTRATION_STATE_ID,
  dependentEffectDefinition,
  movementRoom
} from './movementRoomFixture.js'
import { readRoomChatBodies, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-5.11: a caster ends their own Concentration at any time with no action. The end carries
 * the CHOSEN reason, takes no check and no dice, and every grant that depends on it ends with it.
 */

const HOLDER_ID = testUuid(0x200)
const CHARACTER_ID = testUuid(0x400)

afterEach(() => {
  closeTrackedSockets()
})

type Room = Awaited<ReturnType<typeof movementRoom>>

function characterRoom(config: Partial<Parameters<typeof movementRoom>[0]> = {}) {
  return movementRoom({
    actors: [characterActor({ id: HOLDER_ID, characterId: CHARACTER_ID })],
    moverActorId: HOLDER_ID,
    positions: { [HOLDER_ID]: { x: 150, y: 150 } },
    concentration: true,
    concentrationDependentActorIds: [HOLDER_ID],
    characterPlay: { currentHitPoints: 20 },
    ...config
  })
}

function creatureRoom() {
  return movementRoom({
    actors: [srdCreatureActor({ id: HOLDER_ID, creature: plainWolf })],
    moverActorId: HOLDER_ID,
    positions: { [HOLDER_ID]: { x: 150, y: 150 } },
    concentration: true,
    concentrationDependentActorIds: [HOLDER_ID]
  })
}

async function ends(room: Room) {
  return (await room.receipts()).filter((entry) => entry.commandType === 'CONCENTRATION_END')
}

/** What the helpers below read of a room; an action room carries it as `.room`. */
type SheetRoom = Pick<Room, 'base' | 'encounterId'>

async function streamVersionOf(room: SheetRoom) {
  return runInDurableObject(room.base.stub, (_instance, context) => {
    const play = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((row) => row.characterId === CHARACTER_ID)
    if (!play) throw new Error('Missing room Character play state.')
    return play.streamVersion
  })
}

async function maintained(room: Room) {
  const history = await readRoomHistory(room.base.stub)
  return {
    slots: history.maintainedStates.filter((state) => state.id === CONCENTRATION_STATE_ID),
    dependents: [...history.activeEffects, ...history.characterEffects]
  }
}

/** A Character the Run does not hold keeps its own stream version, which the room never moves. */
type SheetTarget = { characterId: string; expectedVersion: number }

async function sheetFrame(room: SheetRoom, target?: SheetTarget) {
  const commandId = crypto.randomUUID()
  return {
    commandId,
    frame: {
      scope: 'CHARACTER_SHEET',
      characterId: target?.characterId ?? CHARACTER_ID,
      encounterId: room.encounterId,
      command: {
        type: 'END_CONCENTRATION',
        commandId,
        expectedVersion: target?.expectedVersion ?? (await streamVersionOf(room))
      }
    }
  }
}

/** The assigned player ends their Character's Concentration; the room's answer type. */
async function playerEnds(room: SheetRoom, target?: SheetTarget) {
  const player = await connectPlayer(room.base)
  const { commandId, frame } = await sheetFrame(room, target)
  player.socket.send(
    JSON.stringify({ type: 'COMMAND', expectedSessionSequence: 0, command: frame })
  )
  return vi.waitFor(() => {
    const answer = player.messages.find(
      (message) =>
        (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
        message.commandId === commandId
    )
    if (!answer) throw new Error('The room has not answered the command.')
    return answer.type
  })
}

type RoomClient = Pick<Awaited<ReturnType<typeof connectPlayer>>, 'messages'> & {
  socket: { send(data: string): void }
}

/** A fresh subscription reads the timeline as that member sees it. */
async function timelineAs(client: RoomClient) {
  const first = client.messages.length
  client.socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: true }))
  return vi.waitFor(() => {
    const message = client.messages
      .slice(first)
      .find((candidate) => candidate.type === 'ENCOUNTER_SESSION')
    if (message?.type !== 'ENCOUNTER_SESSION' || !message.session.held)
      throw new Error('The room has not sent the held Encounter session.')
    return message.session.timeline?.entries ?? []
  })
}

async function updateActor(room: Room, change: Record<string, unknown>) {
  const commandId = crypto.randomUUID()
  const version = (await readRoomHistory(room.base.stub)).runs[0]!.version
  return room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      type: 'UPDATE_ACTOR',
      encounterId: room.encounterId,
      commandId,
      expectedVersion: version,
      actorId: HOLDER_ID,
      ...change
    }
  })
}

describe('chosen Concentration end (SPELLS-5.11)', () => {
  it("lets a player end their Character's Concentration, ending every dependent grant", async () => {
    const room = await characterRoom()
    const before = await streamVersionOf(room)

    expect(await playerEnds(room)).toBe('COMMAND_COMMITTED')

    const [end, ...rest] = await ends(room)
    expect(rest).toHaveLength(0)
    expect(end?.result).toMatchObject({
      applicationOutputs: {
        kind: 'CONCENTRATION_END',
        ownerActorId: HOLDER_ID,
        maintainedStateId: CONCENTRATION_STATE_ID,
        reason: 'CHOSEN'
      }
    })
    expect(await maintained(room)).toEqual({ slots: [], dependents: [] })
    expect(await streamVersionOf(room)).toBe(before + 1)
    expect(room.diceDrawn()).toBe(0)
    expect((await room.receipts()).filter((r) => r.commandType === 'CONCENTRATION_CHECK')).toEqual(
      []
    )
    expect(await readRoomChatBodies(room.base.stub)).toEqual([
      expect.stringMatching(/ends Concentration\.$/)
    ])
  })

  it("lets the GM end a Creature holder's Concentration", async () => {
    const room = await creatureRoom()

    const answer = await updateActor(room, { endConcentration: true })

    expect(answer.type).toBe('COMMAND_COMMITTED')
    const [end] = await ends(room)
    expect(end?.result).toMatchObject({
      applicationOutputs: { ownerActorId: HOLDER_ID, reason: 'CHOSEN' }
    })
    expect((await maintained(room)).slots).toEqual([])
    expect(room.diceDrawn()).toBe(0)
  })

  it('rejects ending a Concentration the actor does not maintain', async () => {
    const room = await creatureRoom()
    await updateActor(room, { endConcentration: true })

    const answer = await updateActor(room, { endConcentration: true })

    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(await ends(room)).toHaveLength(1)
  })

  it("ends a Character's Concentration only through its Sheet command", async () => {
    const room = await characterRoom()

    const answer = await updateActor(room, { endConcentration: true })

    expect(answer.type).toBe('COMMAND_REJECTED')
    expect((await maintained(room)).slots).toHaveLength(1)
  })

  it('refuses a Character that is not concentrating, writing nothing', async () => {
    const room = await characterRoom({ concentration: false, concentrationDependentActorIds: [] })
    const before = await streamVersionOf(room)

    expect(await playerEnds(room)).toBe('COMMAND_REJECTED')

    expect(await ends(room)).toEqual([])
    expect(await streamVersionOf(room)).toBe(before)
    expect(await readRoomChatBodies(room.base.stub)).toEqual([])
  })

  it('refuses in a Manual Encounter, which records no Concentration to end', async () => {
    const room = await characterRoom({ automationMode: 'MANUAL' })
    const before = await streamVersionOf(room)

    expect(await playerEnds(room)).toBe('COMMAND_REJECTED')

    expect(await ends(room)).toEqual([])
    expect((await maintained(room)).slots).toHaveLength(1)
    expect(await streamVersionOf(room)).toBe(before)
  })

  it("lets the GM end the player's Character's Concentration", async () => {
    const room = await characterRoom()
    const { commandId, frame } = await sheetFrame(room)

    const answer = await room.send(commandId, frame)

    expect(answer.type).toBe('COMMAND_COMMITTED')
    expect((await maintained(room)).slots).toEqual([])
    expect(await ends(room)).toHaveLength(1)
  })

  it('moves the stream of a caster who also holds a dependent grant once, not twice', async () => {
    const room = await characterRoom({ concentrationDependentActorIds: [HOLDER_ID] })
    const before = await streamVersionOf(room)

    expect(await playerEnds(room)).toBe('COMMAND_COMMITTED')

    expect((await maintained(room)).dependents).toEqual([])
    expect(await streamVersionOf(room)).toBe(before + 1)
  })
})

describe('a caster outside the Run ends a carried Concentration (SPELLS-5.11, Q1)', () => {
  const CASTER_ID = testUuid(0x410)

  /** The Run holds a Character carrying a grant the outside caster's Concentration keeps alive. */
  function outsideCasterRoom(stamped = true, source?: { label: string; hidden: boolean }) {
    return movementRoom({
      actors: [characterActor({ id: HOLDER_ID, characterId: CHARACTER_ID })],
      moverActorId: HOLDER_ID,
      positions: { [HOLDER_ID]: { x: 150, y: 150 } },
      characterPlay: { currentHitPoints: 20 },
      outsideCasterCharacterId: CASTER_ID,
      seed: async ({ effects, encounterId, occurredAt }) => {
        // With a `source`, the real planned grant carries its label and whether it is hidden (D99).
        const grant = source
          ? plannedModifierGrant({
              encounterId,
              sourceActorId: HOLDER_ID,
              holderActorId: HOLDER_ID,
              lifecycle: {},
              sourceLabel: source.label,
              sourceHidden: source.hidden
            })
          : null
        await effects.create({
          id: testUuid(0x5200),
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HOLDER_ID },
          lifecycle: {
            ...(grant?.lifecycle ?? { schemaVersion: 1, remainingTicks: 3 }),
            concentrationCasterCharacterId: stamped ? CASTER_ID : null
          },
          definition:
            grant?.definition ?? dependentEffectDefinition({ encounterId, sourceActorId: HOLDER_ID }),
          occurredAt
        })
      }
    })
  }

  const casterTarget = { characterId: CASTER_ID, expectedVersion: 0 }

  it("ends the held Character's grant at once and records the caster for the checkpoint", async () => {
    const room = await outsideCasterRoom()
    const before = await streamVersionOf(room)
    expect((await readRoomHistory(room.base.stub)).characterEffects).toHaveLength(1)

    expect(await playerEnds(room, casterTarget)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.base.stub)
    expect(after.characterEffects).toEqual([])
    expect(after.runs[0]!.concentrationCasterCharacterIds).toEqual([CASTER_ID])
    expect(await streamVersionOf(room)).toBe(before + 1)
    expect(room.diceDrawn()).toBe(0)
  })

  it("lets the GM end the player's Character's carried Concentration", async () => {
    const room = await outsideCasterRoom()
    const { commandId, frame } = await sheetFrame(room, casterTarget)

    const answer = await room.send(commandId, frame)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await readRoomHistory(room.base.stub)).characterEffects).toEqual([])
  })

  it('replays an exact retry from its stored acknowledgement, ending and recording nothing twice', async () => {
    const room = await outsideCasterRoom()
    const player = await connectPlayer(room.base)
    const { commandId, frame } = await sheetFrame(room, casterTarget)
    const send = () =>
      player.socket.send(
        JSON.stringify({ type: 'COMMAND', expectedSessionSequence: 0, command: frame })
      )
    const committed = () =>
      player.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    send()
    await vi.waitFor(() => expect(committed()).toHaveLength(1))
    const first = await readRoomHistory(room.base.stub)

    send()
    await vi.waitFor(() => expect(committed()).toHaveLength(2))

    const [original, replay] = committed()
    expect(replay).toEqual(original)
    const after = await readRoomHistory(room.base.stub)
    expect(after.runs[0]!.version).toBe(first.runs[0]!.version)
    expect(after.commands.filter((row) => row.commandId === commandId)).toHaveLength(1)
    expect(after.runs[0]!.concentrationCasterCharacterIds).toEqual([CASTER_ID])
  })

  it('tells the GM, and no player, who dropped which Concentration and where it ended', async () => {
    const room = await outsideCasterRoom()
    const player = await connectPlayer(room.base)
    const { commandId, frame } = await sheetFrame(room, casterTarget)
    player.socket.send(
      JSON.stringify({ type: 'COMMAND', expectedSessionSequence: 0, command: frame })
    )
    await vi.waitFor(() =>
      expect(
        player.messages.some(
          (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
        )
      ).toBe(true)
    )
    const gm = await timelineAs(room.base)
    expect(gm).toContainEqual(
      expect.objectContaining({
        commandType: 'CONCENTRATION_DROPPED_OUTSIDE',
        visibility: 'PRIVATE',
        label: expect.stringMatching(/^.+ dropped Concentration: .+ ends on .+$/)
      })
    )
    expect(
      (await timelineAs(player)).filter(
        (entry) => entry.commandType === 'CONCENTRATION_DROPPED_OUTSIDE'
      )
    ).toEqual([])
  })

  describe('the source named in the drop notice (PRIVACY-4.1, D99, D101)', () => {
    const SOURCE_LABEL = 'Moonlit Tincture'

    /**
     * A player subscribed to the timeline drops the Concentration, sends the same command again,
     * and a second player connection catches up afterwards. Everything each socket received is
     * kept, so a name leaking through any frame the room pushes is found.
     */
    async function dropAsPlayer(hidden: boolean) {
      const room = await outsideCasterRoom(true, { label: SOURCE_LABEL, hidden })
      const player = await connectPlayer(room.base)
      await timelineAs(player)
      const { commandId, frame } = await sheetFrame(room, casterTarget)
      const send = () =>
        player.socket.send(
          JSON.stringify({ type: 'COMMAND', expectedSessionSequence: 0, command: frame })
        )
      const committed = () =>
        player.messages.filter(
          (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
        )
      send()
      await vi.waitFor(() => expect(committed()).toHaveLength(1))
      send()
      await vi.waitFor(() => expect(committed()).toHaveLength(2))
      const reconnected = await connectPlayer(room.base)
      return {
        room,
        player,
        reconnected,
        gmTimeline: await timelineAs(room.base),
        playerTimeline: await timelineAs(player),
        reconnectedTimeline: await timelineAs(reconnected)
      }
    }

    it.each([
      { hidden: true, shown: 'never names' },
      { hidden: false, shown: 'does not carry the notice either, even naming no hidden source' }
    ])('tells the GM the source and no player ($shown it)', async ({ hidden }) => {
      const { room, player, reconnected, gmTimeline, playerTimeline, reconnectedTimeline } =
        await dropAsPlayer(hidden)

      expect(gmTimeline).toContainEqual(
        expect.objectContaining({
          commandType: 'CONCENTRATION_DROPPED_OUTSIDE',
          label: expect.stringContaining(`dropped Concentration: ${SOURCE_LABEL} ends on`)
        })
      )
      expect(JSON.stringify(room.base.messages)).toContain(SOURCE_LABEL)
      for (const timeline of [playerTimeline, reconnectedTimeline])
        expect(timeline.map((entry) => entry.commandType)).not.toContain(
          'CONCENTRATION_DROPPED_OUTSIDE'
        )
      // Every frame the room pushed to a player, the replay of their command and the catch-up
      // of a fresh connection included.
      if (hidden)
        for (const client of [player, reconnected])
          expect(JSON.stringify(client.messages)).not.toContain(SOURCE_LABEL)
    })
  })

  it('refuses a caster whose Concentration keeps nothing alive, writing nothing', async () => {
    const room = await outsideCasterRoom(false)

    expect(await playerEnds(room, casterTarget)).toBe('COMMAND_REJECTED')

    const after = await readRoomHistory(room.base.stub)
    expect(after.characterEffects).toHaveLength(1)
    expect(after.runs[0]!.concentrationCasterCharacterIds).toEqual([])
  })

  it('reaches the room for no other Sheet command of a Character the Run does not hold', async () => {
    const room = await outsideCasterRoom()
    const commandId = crypto.randomUUID()

    const answer = await room.send(commandId, {
      scope: 'CHARACTER_SHEET',
      characterId: CASTER_ID,
      encounterId: room.encounterId,
      command: { type: 'SET_INSPIRATION', commandId, expectedVersion: 0, inspired: true }
    })

    expect(answer.type).toBe('COMMAND_REJECTED')
  })
})

describe('undoing after a chosen Concentration end (SPELLS-5.11)', () => {
  const ATTACKER_ID = testUuid(0x210)

  it('is refused, since the end changed the Encounter after the action', async () => {
    const attacker = biteWolf('ATTACK')
    // The Wolf's attack die shows 19 and hits; the Character's save die shows 20 and keeps the Concentration.
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: [18, 19],
      actors: [
        srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
        characterActor({ id: HOLDER_ID, characterId: CHARACTER_ID })
      ],
      ownerFeatureId: creatureFeature(attacker, 'Bite').id,
      concentration: true,
      concentrationOwnerActorId: HOLDER_ID,
      concentrationDependentActorIds: [HOLDER_ID],
      characterPlay: { currentHitPoints: 20 }
    })
    const { answer } = await room.startAction(HOLDER_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await maintained(room.room)).slots).toHaveLength(1)
    expect(await playerEnds(room.room)).toBe('COMMAND_COMMITTED')

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })

    expect(undone).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'REVERT_UNAVAILABLE' })
  })
})
