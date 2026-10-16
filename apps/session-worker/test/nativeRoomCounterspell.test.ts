import { runInDurableObject } from 'cloudflare:test'
import { characterActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { encounterActionPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/encounterActionPending'
import { counterspell } from '@artificer-toolkit/source-data/srd/spells/counterspell.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { mend } from './mendSpell.js'
import {
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * REACTION-4.3 (first step): a Character's spell cast offers another Character in range a held
 * Counterspell before it does anything. A countered cast spends its slot and action and has no
 * effect; the counter spends its own slot and reaction.
 */

const CASTER_ACTOR_ID = testUuid(0x7e0)
const CASTER_ID = testUuid(0x7e1)
const REACTOR_ACTOR_ID = testUuid(0x7e2)
const REACTOR_ID = testUuid(0x7e3)
const SLOT_SPENT = (level: number) => [{ slotKey: `STANDARD:${level}`, used: 1 }]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A wounded Caster mending itself, next to a Character holding Counterspell. */
function counterspellRoom(
  options: Omit<
    Parameters<typeof actionRoom>[0],
    'actors' | 'characterSpellcasting' | 'secondCharacter' | 'characterAction' | 'characterPlay'
  > & { castLevel?: string; reactorSpells?: boolean } = {}
) {
  const { castLevel = '1st', reactorSpells = true, ...rest } = options
  return actionRoom({
    sceneGrid: {
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 30,
      diagonalPolicy: 'EQUAL',
      unit: 'FEET'
    },
    ...rest,
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    characterSpellcasting: { spells: [mend], prepared: [mend.id] },
    characterPlay: { currentHitPoints: 1 },
    secondCharacter: {
      characterId: REACTOR_ID,
      spellcasting: reactorSpells
        ? { spells: [counterspell], prepared: [counterspell.id] }
        : undefined
    },
    characterAction: (action) => action.label === `Mend (${castLevel} level)`
  })
}
type Room = Awaited<ReturnType<typeof counterspellRoom>>

const readPlay = (room: Room, characterId: string) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === characterId)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row)
  })
const slotsOf = async (room: Room, characterId: string) =>
  (await readPlay(room, characterId)).spellSlots ?? []
const hitPointsOf = async (room: Room) => (await readPlay(room, CASTER_ID)).hitpoints.current

/** The Caster mends itself; the room's answer is checked to have committed. */
async function cast(room: Room) {
  const { answer } = await room.startAction(CASTER_ACTOR_ID, [], room.sceneContext(0))
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The reaction choice the room asks of the Counterspell holder. */
async function offered(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'REACTION_CHOICE')
    throw new Error(`Expected the reaction choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

async function undoLastAction(room: Room) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

describe('room Counterspell against a Character’s spell cast (REACTION-4.3)', () => {
  it('holds the cast for the holder’s choice, applying and spending nothing', async () => {
    const room = await counterspellRoom()
    await cast(room)

    const { pending } = await offered(room)
    expect(pending.targetActorId).toBe(REACTOR_ACTOR_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    expect(await hitPointsOf(room)).toBe(1)
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
  })

  it('seals an offer that names only the holder’s reactions and none that declined', async () => {
    const room = await counterspellRoom()
    await cast(room)
    const context = await readPendingActionContext(room.room.base.stub)
    if (context.kind !== 'ENCOUNTER_ACTION' || !context.castReaction)
      throw new Error('Expected a pending cast reaction.')
    const { castReaction } = context
    expect(context.rollerActorId).toBe(REACTOR_ACTOR_ID)
    expect(castReaction.declinedReactorActorIds).toEqual([])

    const parses = (value: unknown) =>
      encounterActionPendingContextDtoSchema.safeParse(value).success
    expect(parses(context)).toBe(true)
    const [first] = castReaction.reactions
    expect(
      parses({
        ...context,
        castReaction: {
          ...castReaction,
          reactions: [{ ...first, reactorActorId: CASTER_ACTOR_ID }]
        }
      })
    ).toBe(false)
    expect(
      parses({
        ...context,
        castReaction: { ...castReaction, declinedReactorActorIds: [REACTOR_ACTOR_ID] }
      })
    ).toBe(false)
  })

  it('counters the cast when used: the slot is spent, the spell does nothing, and one undo restores both', async () => {
    const room = await counterspellRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await cast(room)
    const { decision, pending } = await offered(room)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await hitPointsOf(room)).toBe(1)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(1))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

    await undoLastAction(room)
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)

    // The reaction is back: the same cast offers it again.
    await cast(room)
    await offered(room)
  })

  it('lets the cast resolve when declined, spending nothing of the reactor', async () => {
    const room = await counterspellRoom()
    await cast(room)
    const { decision } = await offered(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await hitPointsOf(room)).toBe(3)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(1))
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
  })

  it('offers only the slots at least as high as the cast', async () => {
    const low = await counterspellRoom()
    await cast(low)
    const lowOptions = (await offered(low)).pending.options.length

    const high = await counterspellRoom({ castLevel: '4th' })
    await cast(high)
    const highOptions = (await offered(high)).pending.options.length

    // Slots 3 to 5 answer a 1st-level cast; only slots 4 and 5 answer a 4th-level one.
    expect([lowOptions, highOptions]).toEqual([3, 2])
  })

  it('refuses an option the pause never offered, leaving the cast held', async () => {
    const room = await counterspellRoom()
    await cast(room)
    const { decision } = await offered(room)
    const version = await room.version()

    const refused = await room.resolve(decision, { kind: 'OPTION', optionId: 'c'.repeat(64) })
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect(await room.version()).toBe(version)
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
  })

  it('replays the answer without countering again', async () => {
    const room = await counterspellRoom()
    await cast(room)
    const { decision, pending } = await offered(room)
    const answer = room.resolveCommand(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect((await room.send(answer)).type).toBe('COMMAND_COMMITTED')
    const version = await room.version()

    expect((await room.send(answer)).type).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(version)
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
  })

  describe('offers no Counterspell', () => {
    it('to a Character beyond its range of the caster', async () => {
      // 100 px is 30 ft here; the holder stands 700 px (210 ft) from the caster.
      const room = await counterspellRoom({ positions: { [REACTOR_ACTOR_ID]: { x: 850, y: 150 } } })
      await cast(room)

      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(3)
      expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    })

    it('to a Character that does not hold the spell', async () => {
      const room = await counterspellRoom({ reactorSpells: false })
      await cast(room)

      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(3)
    })

    it('when the cast is made without the Scene, since range cannot be read', async () => {
      const room = await counterspellRoom()
      const { answer } = await room.startAction(CASTER_ACTOR_ID)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(3)
    })
  })
})
