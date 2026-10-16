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
import { mend, unlimitedCureWounds } from './mendSpell.js'
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
  > & {
    spell?: typeof mend
    castLevel?: string
    reactorSpells?: boolean
    reactorSlotsSpent?: readonly { slotKey: string; used: number }[]
  } = {}
) {
  const {
    spell = mend,
    castLevel = '1st',
    reactorSpells = true,
    reactorSlotsSpent,
    ...rest
  } = options
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
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterPlay: { currentHitPoints: 1 },
    secondCharacter: {
      characterId: REACTOR_ID,
      play: { spellSlots: reactorSlotsSpent },
      spellcasting: reactorSpells
        ? { spells: [counterspell], prepared: [counterspell.id] }
        : undefined
    },
    characterAction: (action) => action.label === `${spell.label} (${castLevel} level)`
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
    const low = await counterspellRoom({ spell: unlimitedCureWounds })
    await cast(low)
    const lowOptions = (await offered(low)).pending.options.length

    const high = await counterspellRoom({ spell: unlimitedCureWounds, castLevel: '4th' })
    await cast(high)
    const highOptions = (await offered(high)).pending.options.length

    // Every slot from 3 up is offered either way: a slot below a higher-level cast owes a check.
    expect([lowOptions, highOptions]).toEqual([3, 3])
  })

  it('offers nothing when the holder has no slot left that can counter', async () => {
    const spent = [3, 4, 5].map((level) => ({ slotKey: `STANDARD:${level}`, used: 1 }))
    const room = await counterspellRoom({
      spell: unlimitedCureWounds,
      castLevel: '4th',
      reactorSlotsSpent: spent
    })
    await cast(room)
    expect((await room.pendingDecision()).pending.kind).not.toBe('REACTION_CHOICE')
    expect(await slotsOf(room, REACTOR_ID)).toEqual(spent)
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

  describe('a counter below the cast’s level owes a spellcasting check (D125)', () => {
    /** A 4th-level cast; the holder's 3rd-level slot, the first offered, owes a check against DC 14. */
    const highCast = (options: Parameters<typeof counterspellRoom>[0] = {}) =>
      counterspellRoom({ spell: unlimitedCureWounds, castLevel: '4th', ...options })

    /** Counters with the holder's lowest slot and returns the room's answer. */
    async function counterWithLowestSlot(room: Room) {
      const { decision, pending } = await offered(room)
      return room.resolve(decision, { kind: 'OPTION', optionId: pending.options[0].optionId })
    }

    /** The roll the holder owes, answered with one natural d20 face. */
    async function rollTheCheck(room: Room, face: number) {
      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the counter check.')
      return room.resolve(decision, {
        kind: 'ENTER_DICE',
        requestId: decision.pending.request.requestId,
        rawFaces: [face],
        rollMode: decision.pending.request.rollMode
      })
    }

    /** The cast's healing dice (4d8 here), each answered with the lowest face. */
    async function healWithLowestDice(room: Room) {
      for (;;) {
        const decision = await readPendingActionDecision(room.room.base.stub)
        if (!decision) return
        if (decision.pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
          throw new Error(`Expected a healing die, got ${decision.pending.kind}.`)
        const healed = await room.resolve(decision, {
          kind: 'ENTER_INTEGER',
          requestId: decision.pending.request.requestId,
          value: decision.pending.request.min
        })
        expect(healed.type, JSON.stringify(healed)).toBe('COMMAND_COMMITTED')
      }
    }

    it('pauses for the holder’s roll, spending and applying nothing', async () => {
      const room = await highCast()
      await cast(room)
      expect((await counterWithLowestSlot(room)).type).toBe('COMMAND_COMMITTED')

      const context = await readPendingActionContext(room.room.base.stub)
      if (context.kind !== 'ENCOUNTER_ACTION' || !context.castReaction?.check)
        throw new Error('Expected a pending counter check.')
      expect(context.rollerActorId).toBe(REACTOR_ACTOR_ID)
      expect(context.castReaction.check).toMatchObject({ triggerLevel: 4, dc: 14 })
      expect((await room.pendingDecision()).pending.kind).toBe('D20_EVIDENCE')
      expect(await hitPointsOf(room)).toBe(1)
      expect(await slotsOf(room, CASTER_ID)).toEqual([])
      expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    })

    it('counters the cast on a passing roll, and one undo restores both slots', async () => {
      const room = await highCast()
      const before = await readRoomHistory(room.room.base.stub)
      await cast(room)
      await counterWithLowestSlot(room)

      const rolled = await rollTheCheck(room, 20)
      expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(1)
      expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

      await undoLastAction(room)
      expect(await slotsOf(room, CASTER_ID)).toEqual([])
      expect(await slotsOf(room, REACTOR_ID)).toEqual([])
      expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
    })

    it('lets the cast resolve on a failing roll, spending the holder’s slot with it; one undo restores all', async () => {
      const room = await highCast()
      const before = await readRoomHistory(room.room.base.stub)
      await cast(room)
      await counterWithLowestSlot(room)

      const rolled = await rollTheCheck(room, 1)
      expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
      // The failed attempt is not offered again: the cast goes on to its own healing.
      await healWithLowestDice(room)
      expect(await hitPointsOf(room)).toBe(5)
      expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

      await undoLastAction(room)
      expect(await slotsOf(room, CASTER_ID)).toEqual([])
      expect(await slotsOf(room, REACTOR_ID)).toEqual([])
      expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
    })

    it('settles the roll inside the choice when the holder’s player has the app roll', async () => {
      const passing = await highCast({ autoRoll: 'EVERYONE', rolls: [19] })
      await cast(passing)
      expect((await counterWithLowestSlot(passing)).type).toBe('COMMAND_COMMITTED')
      expect(await readPendingActionDecision(passing.room.base.stub)).toBeNull()
      expect(await hitPointsOf(passing)).toBe(1)
      expect(await slotsOf(passing, REACTOR_ID)).toEqual(SLOT_SPENT(3))

      const failing = await highCast({ autoRoll: 'EVERYONE', rolls: [0] })
      await cast(failing)
      expect((await counterWithLowestSlot(failing)).type).toBe('COMMAND_COMMITTED')
      expect(await readPendingActionDecision(failing.room.base.stub)).toBeNull()
      expect(await hitPointsOf(failing)).toBeGreaterThan(1)
      expect(await slotsOf(failing, REACTOR_ID)).toEqual(SLOT_SPENT(3))
    })

    it('owes no roll from a slot at the cast’s level or higher', async () => {
      const room = await highCast()
      await cast(room)
      const { decision, pending } = await offered(room)

      const used = await room.resolve(decision, {
        kind: 'OPTION',
        optionId: pending.options[2].optionId
      })
      expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(1)
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(5))
    })

    it('refuses a decline or a choice in place of the roll, leaving the check held', async () => {
      const room = await highCast()
      await cast(room)
      await counterWithLowestSlot(room)
      const decision = await room.pendingDecision()
      const version = await room.version()

      for (const resolution of [
        { kind: 'DECLINE' },
        { kind: 'OPTION', optionId: 'c'.repeat(64) }
      ]) {
        const refused = await room.resolve(decision, resolution)
        expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
      }
      expect(await room.version()).toBe(version)
      expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    })
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
