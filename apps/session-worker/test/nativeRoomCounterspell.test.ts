import { runInDurableObject } from 'cloudflare:test'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { characterActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { encounterActionPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/encounterActionPending'
import { counterspell } from '@artificer-toolkit/source-data/srd/spells/counterspell.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { mend, unlimitedCureWounds } from './mendSpell.js'
import {
  parseReceiptExecution,
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory,
  readRoomRollCards
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
const SECOND_REACTOR_ACTOR_ID = testUuid(0x7e4)
const SECOND_REACTOR_ID = testUuid(0x7e5)
const SLOT_SPENT = (level: number) => [{ slotKey: `STANDARD:${level}`, used: 1 }]
const invisible = srdSystemRecord.conditionTypes.find(({ code }) => code === 'INVISIBLE')
if (!invisible) throw new Error('The SRD names the Invisible condition.')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A wounded Caster mending itself, next to a Character holding Counterspell. */
function counterspellRoom(
  options: Omit<
    Parameters<typeof actionRoom>[0],
    | 'actors'
    | 'characterSpellcasting'
    | 'secondCharacter'
    | 'thirdCharacter'
    | 'characterAction'
    | 'characterPlay'
  > & {
    spell?: typeof mend
    castLevel?: string
    reactorSpells?: boolean
    /** A second holder of Counterspell, owned by another player. */
    secondReactor?: boolean
    reactorSlotsSpent?: readonly { slotKey: string; used: number }[]
    /** Sheet conditions the Caster already carries. */
    casterConditions?: { conditionTypeId: string; label: string }[]
    /** Sheet conditions the Counterspell holder already carries. */
    reactorConditions?: { conditionTypeId: string; label: string }[]
    /** The Caster also holds Counterspell, so it can answer a counter to its own cast. */
    casterCounterspell?: boolean
    casterSlotsSpent?: readonly { slotKey: string; used: number }[]
  } = {}
) {
  const {
    spell = mend,
    castLevel = '1st',
    reactorSpells = true,
    secondReactor = false,
    casterCounterspell = false,
    casterSlotsSpent,
    reactorSlotsSpent,
    casterConditions,
    reactorConditions,
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
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID }),
      ...(secondReactor
        ? [characterActor({ id: SECOND_REACTOR_ACTOR_ID, characterId: SECOND_REACTOR_ID })]
        : [])
    ],
    ...(secondReactor && {
      positions: { [SECOND_REACTOR_ACTOR_ID]: { x: 250, y: 250 }, ...rest.positions },
      thirdCharacter: {
        characterId: SECOND_REACTOR_ID,
        spellcasting: { spells: [counterspell], prepared: [counterspell.id] }
      }
    }),
    characterSpellcasting: casterCounterspell
      ? { spells: [spell, counterspell], prepared: [spell.id, counterspell.id] }
      : { spells: [spell], prepared: [spell.id] },
    characterPlay: {
      currentHitPoints: 1,
      spellSlots: casterSlotsSpent,
      ...(casterConditions && { conditions: casterConditions })
    },
    secondCharacter: {
      characterId: REACTOR_ID,
      play: {
        spellSlots: reactorSlotsSpent,
        ...(reactorConditions && { conditions: reactorConditions })
      },
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

  it('uses up the caster’s grant that ends on a cast, and releases its condition, even when the cast is countered, and one undo gives both back (SPELLS-27.1)', async () => {
    const room = await counterspellRoom({
      casterConditions: [{ conditionTypeId: invisible.id, label: 'Invisible' }],
      seed: seedModifierGrant({
        sourceActorId: CASTER_ACTOR_ID,
        holderActorId: CASTER_ACTOR_ID,
        lifecycle: {},
        endsOnCast: true,
        ownedConditionId: invisible.id
      })
    })
    const grantIds = async () =>
      (await readRoomHistory(room.room.base.stub)).characterEffects.map(({ id }) => id)
    const conditionIds = async () =>
      ((await readPlay(room, CASTER_ID)).conditions ?? []).map(
        ({ conditionTypeId }) => conditionTypeId
      )
    const held = await grantIds()
    expect(held).toHaveLength(1)
    await cast(room)
    const { decision, pending } = await offered(room)
    expect(await grantIds()).toEqual(held)
    expect(await conditionIds()).toEqual([invisible.id])

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await grantIds()).toEqual([])
    expect(await conditionIds()).toEqual([])

    await undoLastAction(room)
    expect(await grantIds()).toEqual(held)
    expect(await conditionIds()).toEqual([invisible.id])
  })

  it('ends the grant once when the cast is declined and then resolves', async () => {
    const room = await counterspellRoom({
      casterConditions: [{ conditionTypeId: invisible.id, label: 'Invisible' }],
      seed: seedModifierGrant({
        sourceActorId: CASTER_ACTOR_ID,
        holderActorId: CASTER_ACTOR_ID,
        lifecycle: {},
        endsOnCast: true,
        ownedConditionId: invisible.id
      })
    })
    const grantIds = async () =>
      (await readRoomHistory(room.room.base.stub)).characterEffects.map(({ id }) => id)
    const held = await grantIds()
    await cast(room)
    const { decision } = await offered(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await grantIds()).toEqual([])
    expect(
      ((await readPlay(room, CASTER_ID)).conditions ?? []).map(
        ({ conditionTypeId }) => conditionTypeId
      )
    ).toEqual([])

    await undoLastAction(room)
    expect(await grantIds()).toEqual(held)
  })

  it('replays a declined offer without ending the grant a second time or changing the Run', async () => {
    const room = await counterspellRoom({
      casterConditions: [{ conditionTypeId: invisible.id, label: 'Invisible' }],
      seed: seedModifierGrant({
        sourceActorId: CASTER_ACTOR_ID,
        holderActorId: CASTER_ACTOR_ID,
        lifecycle: {},
        endsOnCast: true,
        ownedConditionId: invisible.id
      })
    })
    await cast(room)
    const { decision } = await offered(room)
    const decline = room.resolveCommand(decision, { kind: 'DECLINE' })
    expect((await room.send(decline)).type).toBe('COMMAND_COMMITTED')
    const version = await room.version()
    const settled = await readRoomHistory(room.room.base.stub)
    expect(settled.characterEffects).toEqual([])

    expect((await room.send(decline)).type).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(version)
    expect(await readRoomHistory(room.room.base.stub)).toEqual(settled)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(1))
  })

  it('uses up the Counterspell holder’s own grant that ends on a cast, and releases its condition, when it counters; one undo gives both back (SPELLS-27.1)', async () => {
    const room = await counterspellRoom({
      reactorConditions: [{ conditionTypeId: invisible.id, label: 'Invisible' }],
      seed: seedModifierGrant({
        sourceActorId: REACTOR_ACTOR_ID,
        holderActorId: REACTOR_ACTOR_ID,
        lifecycle: {},
        endsOnCast: true,
        ownedConditionId: invisible.id
      })
    })
    const grantIds = async () =>
      (await readRoomHistory(room.room.base.stub)).characterEffects.map(({ id }) => id)
    const conditionIds = async () =>
      ((await readPlay(room, REACTOR_ID)).conditions ?? []).map(
        ({ conditionTypeId }) => conditionTypeId
      )
    const held = await grantIds()
    expect(held).toHaveLength(1)
    await cast(room)
    const { decision, pending } = await offered(room)
    expect(await grantIds()).toEqual(held)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
    expect(await grantIds()).toEqual([])
    expect(await conditionIds()).toEqual([])

    await undoLastAction(room)
    expect(await grantIds()).toEqual(held)
    expect(await conditionIds()).toEqual([invisible.id])
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

  describe('a counter below the cast’s level owes a spellcasting check (D127)', () => {
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
      expect(await hitPointsOf(room)).toBeGreaterThan(1)
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

    it('spends a failing holder’s slot through its own Character write when the holder is the cast’s target', async () => {
      const room = await highCast()
      const before = await readRoomHistory(room.room.base.stub)
      const { answer } = await room.startAction(REACTOR_ACTOR_ID, [], room.sceneContext(1))
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      expect((await counterWithLowestSlot(room)).type).toBe('COMMAND_COMMITTED')

      expect((await rollTheCheck(room, 1)).type).toBe('COMMAND_COMMITTED')
      await healWithLowestDice(room)
      expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

      await undoLastAction(room)
      expect(await slotsOf(room, CASTER_ID)).toEqual([])
      expect(await slotsOf(room, REACTOR_ID)).toEqual([])
      expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
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

    it('records the check pause’s d20 evidence on its receipt', async () => {
      const room = await highCast()
      await cast(room)
      await counterWithLowestSlot(room)

      const paused = (await readRoomHistory(room.room.base.stub)).receipts
        .map(parseReceiptExecution)
        .filter((execution) => execution.status === 'PAUSED')
        .at(-1)
      expect(paused).toMatchObject({ pending: { kind: 'D20_EVIDENCE', rollMode: 'NORMAL' } })
    })

    it('cards the holder’s check roll, passing or failing, from the holder', async () => {
      for (const face of [1, 20]) {
        const room = await highCast()
        await cast(room)
        await counterWithLowestSlot(room)
        expect((await rollTheCheck(room, face)).type).toBe('COMMAND_COMMITTED')
        // A failing check is carded with the cast's own commit, after its healing dice.
        await healWithLowestDice(room)

        const cards = (await readRoomRollCards(room.room.base.stub)).filter(
          ({ roll }) => roll.source.kind === 'SKILL_CHECK'
        )
        expect(cards, `face ${face}`).toHaveLength(1)
        expect(cards[0]!.roll.source.label).toMatch(/^Counter: /)
        expect(cards[0]!.roll.characterLabel).toBe(
          readStoredRunActor(
            (await readRoomHistory(room.room.base.stub)).actors.find(
              ({ id }) => id === REACTOR_ACTOR_ID
            )!
          ).label
        )
      }
    })

    it('cards the check once when the app rolled it inside the choice', async () => {
      const room = await highCast({ autoRoll: 'EVERYONE', rolls: [0] })
      await cast(room)
      await counterWithLowestSlot(room)

      const cards = (await readRoomRollCards(room.room.base.stub)).filter(
        ({ roll }) => roll.source.kind === 'SKILL_CHECK'
      )
      expect(cards).toHaveLength(1)
      expect(cards[0]!.roll.source.label).toMatch(/^Counter: /)
    })

    it('undoes an auto-rolled failing check with the cast, restoring both slots', async () => {
      const room = await highCast({ autoRoll: 'EVERYONE', rolls: [0] })
      const before = await readRoomHistory(room.room.base.stub)
      await cast(room)
      await counterWithLowestSlot(room)
      expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

      await undoLastAction(room)
      expect(await slotsOf(room, CASTER_ID)).toEqual([])
      expect(await slotsOf(room, REACTOR_ID)).toEqual([])
      expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
    })

    describe('with a second holder in range', () => {
      /** Each holder in turn is offered the cast and counters with its lowest slot. */
      async function counterWithBothHolders(room: Room, faces: readonly [number, number]) {
        for (const [index, holderActorId] of [
          REACTOR_ACTOR_ID,
          SECOND_REACTOR_ACTOR_ID
        ].entries()) {
          expect((await offered(room)).pending.targetActorId).toBe(holderActorId)
          const chosen = await counterWithLowestSlot(room)
          expect(chosen.type, JSON.stringify(chosen)).toBe('COMMAND_COMMITTED')
          const rolled = await rollTheCheck(room, faces[index]!)
          expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
          if (faces[index]! === 20) return
        }
      }

      it('spends every failing holder’s slot with the cast; one undo restores all', async () => {
        const room = await highCast({ secondReactor: true })
        const before = await readRoomHistory(room.room.base.stub)
        await cast(room)

        await counterWithBothHolders(room, [1, 1])
        await healWithLowestDice(room)
        expect(await hitPointsOf(room)).toBeGreaterThan(1)
        expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
        expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
        expect(await slotsOf(room, SECOND_REACTOR_ID)).toEqual(SLOT_SPENT(3))

        await undoLastAction(room)
        for (const characterId of [CASTER_ID, REACTOR_ID, SECOND_REACTOR_ID])
          expect(await slotsOf(room, characterId)).toEqual([])
        expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
      })

      it('counters on the second holder’s pass after the first failed, spending both slots; one undo restores all', async () => {
        const room = await highCast({ secondReactor: true })
        const before = await readRoomHistory(room.room.base.stub)
        await cast(room)

        await counterWithBothHolders(room, [1, 20])
        expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
        expect(await hitPointsOf(room)).toBe(1)
        expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
        expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
        expect(await slotsOf(room, SECOND_REACTOR_ID)).toEqual(SLOT_SPENT(3))

        await undoLastAction(room)
        for (const characterId of [CASTER_ID, REACTOR_ID, SECOND_REACTOR_ID])
          expect(await slotsOf(room, characterId)).toEqual([])
        expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
      })
    })
  })

  describe('a Counterspell is itself a cast another holder can counter', () => {
    /** The creature offered the Counterspell now answers it with the option at `index` (its lowest slot by default). */
    async function answerWithSlot(room: Room, holderActorId: string, index = 0) {
      const { decision, pending } = await offered(room)
      expect(pending.targetActorId).toBe(holderActorId)
      const answered = await room.resolve(decision, {
        kind: 'OPTION',
        optionId: pending.options[index]!.optionId
      })
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    }

    async function declineAs(room: Room, holderActorId: string) {
      const { decision, pending } = await offered(room)
      expect(pending.targetActorId).toBe(holderActorId)
      const declined = await room.resolve(decision, { kind: 'DECLINE' })
      expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    }

    async function rollTheCheck(room: Room, face: number) {
      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the counter check.')
      const rolled = await room.resolve(decision, {
        kind: 'ENTER_DICE',
        requestId: decision.pending.request.requestId,
        rawFaces: [face],
        rollMode: decision.pending.request.rollMode
      })
      expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    }

    it('offers the counter to the next holder, holding the cast and spending nothing', async () => {
      const room = await counterspellRoom({ secondReactor: true })
      await cast(room)
      await answerWithSlot(room, REACTOR_ACTOR_ID)

      const { pending } = await offered(room)
      expect(pending.targetActorId).toBe(SECOND_REACTOR_ACTOR_ID)
      const context = await readPendingActionContext(room.room.base.stub)
      if (context.kind !== 'ENCOUNTER_ACTION' || !context.castReaction)
        throw new Error('Expected a pending cast reaction.')
      expect(context.rollerActorId).toBe(SECOND_REACTOR_ACTOR_ID)
      expect(context.failedCounters ?? []).toEqual([])
      expect(context.castReaction.declinedReactorActorIds).toEqual([])
      expect(context.castReaction.chain).toMatchObject({
        castDeclinedReactorActorIds: [],
        castLevel: 3,
        counters: [
          {
            reaction: { reactorActorId: REACTOR_ACTOR_ID },
            againstActorId: CASTER_ACTOR_ID,
            triggerLevel: 1,
            check: null
          }
        ]
      })
      expect(encounterActionPendingContextDtoSchema.safeParse(context).success).toBe(true)
      expect(await hitPointsOf(room)).toBe(1)
      for (const characterId of [CASTER_ID, REACTOR_ID, SECOND_REACTOR_ID])
        expect(await slotsOf(room, characterId)).toEqual([])
    })

    it('lets the cast resolve when the next holder counters the counter; each slot is spent and one undo restores all', async () => {
      const room = await counterspellRoom({ secondReactor: true })
      const before = await readRoomHistory(room.room.base.stub)
      await cast(room)
      await answerWithSlot(room, REACTOR_ACTOR_ID)

      await answerWithSlot(room, SECOND_REACTOR_ACTOR_ID)
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(3)
      expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(1))
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
      expect(await slotsOf(room, SECOND_REACTOR_ID)).toEqual(SLOT_SPENT(3))

      await undoLastAction(room)
      for (const characterId of [CASTER_ID, REACTOR_ID, SECOND_REACTOR_ID])
        expect(await slotsOf(room, characterId)).toEqual([])
      expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
    })

    it('keeps the cast countered when the next holder declines the counter', async () => {
      const room = await counterspellRoom({ secondReactor: true })
      const before = await readRoomHistory(room.room.base.stub)
      await cast(room)
      await answerWithSlot(room, REACTOR_ACTOR_ID)

      await declineAs(room, SECOND_REACTOR_ACTOR_ID)
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(1)
      expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(1))
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
      expect(await slotsOf(room, SECOND_REACTOR_ID)).toEqual([])

      await undoLastAction(room)
      expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
    })

    it('offers the counter to a holder that declined the cast itself', async () => {
      const room = await counterspellRoom({ secondReactor: true })
      const before = await readRoomHistory(room.room.base.stub)
      await cast(room)
      await declineAs(room, REACTOR_ACTOR_ID)
      await answerWithSlot(room, SECOND_REACTOR_ACTOR_ID)

      await answerWithSlot(room, REACTOR_ACTOR_ID)
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(3)
      expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(1))
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
      expect(await slotsOf(room, SECOND_REACTOR_ID)).toEqual(SLOT_SPENT(3))

      await undoLastAction(room)
      expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
    })

    it('measures the counter’s range from the creature that cast it', async () => {
      // 100 px is 30 ft: the second holder stands 75 ft from the caster, too far for the cast, and 45 ft
      // from the first holder, close enough for its counter.
      const room = await counterspellRoom({
        secondReactor: true,
        positions: { [SECOND_REACTOR_ACTOR_ID]: { x: 400, y: 150 } }
      })
      await cast(room)
      await declineAs(room, REACTOR_ACTOR_ID)
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(3)

      await undoLastAction(room)
      await cast(room)
      await answerWithSlot(room, REACTOR_ACTOR_ID)
      expect((await offered(room)).pending.targetActorId).toBe(SECOND_REACTOR_ACTOR_ID)
    })

    describe('with a counter cast above the next holder’s slot (D127)', () => {
      /** The first holder counters with its 5th-level slot, so the second owes a check against DC 15. */
      async function highCounter() {
        const room = await counterspellRoom({ secondReactor: true })
        await cast(room)
        await answerWithSlot(room, REACTOR_ACTOR_ID, 2)
        await answerWithSlot(room, SECOND_REACTOR_ACTOR_ID)
        return room
      }

      it('pauses for the second holder’s roll against the counter’s level', async () => {
        const room = await highCounter()
        const context = await readPendingActionContext(room.room.base.stub)
        if (context.kind !== 'ENCOUNTER_ACTION' || !context.castReaction?.check)
          throw new Error('Expected a pending counter check.')
        expect(context.rollerActorId).toBe(SECOND_REACTOR_ACTOR_ID)
        expect(context.castReaction.check).toMatchObject({ triggerLevel: 5, dc: 15 })
        expect(context.castReaction.chain?.counters).toHaveLength(1)
        expect(await slotsOf(room, SECOND_REACTOR_ID)).toEqual([])
      })

      it('lets the cast resolve on a passing roll', async () => {
        const room = await highCounter()
        await rollTheCheck(room, 20)
        expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
        expect(await hitPointsOf(room)).toBe(3)
        expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(5))
        expect(await slotsOf(room, SECOND_REACTOR_ID)).toEqual(SLOT_SPENT(3))
      })

      it('keeps the cast countered on a failing roll, spending the failing holder’s slot, and cards its roll', async () => {
        const room = await highCounter()
        const before = await readRoomHistory(room.room.base.stub)
        await rollTheCheck(room, 1)
        expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
        expect(await hitPointsOf(room)).toBe(1)
        expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(1))
        expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(5))
        expect(await slotsOf(room, SECOND_REACTOR_ID)).toEqual(SLOT_SPENT(3))

        const cards = (await readRoomRollCards(room.room.base.stub)).filter(
          ({ roll }) => roll.source.kind === 'SKILL_CHECK'
        )
        expect(cards).toHaveLength(1)
        expect(cards[0]!.roll.source.label).toMatch(/^Counter: /)

        await undoLastAction(room)
        expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
      })
    })
  })

  describe('the cast’s own caster can counter a Counterspell cast against it (REACTION-4.3)', () => {
    async function answer(room: Room, holderActorId: string, index = 0) {
      const { decision, pending } = await offered(room)
      expect(pending.targetActorId).toBe(holderActorId)
      const answered = await room.resolve(decision, {
        kind: 'OPTION',
        optionId: pending.options[index]!.optionId
      })
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    }

    it('lets the cast resolve when the caster counters the counter; every slot and the caster’s reaction are spent, and one undo restores all', async () => {
      const room = await counterspellRoom({ casterCounterspell: true })
      const before = await readRoomHistory(room.room.base.stub)
      await cast(room)
      await answer(room, REACTOR_ACTOR_ID)

      const { pending } = await offered(room)
      expect(pending.targetActorId).toBe(CASTER_ACTOR_ID)
      expect(await slotsOf(room, CASTER_ID)).toEqual([])

      await answer(room, CASTER_ACTOR_ID)
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(3)
      expect(await slotsOf(room, CASTER_ID)).toEqual([...SLOT_SPENT(1), ...SLOT_SPENT(3)])
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

      await undoLastAction(room)
      expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
      expect(await slotsOf(room, CASTER_ID)).toEqual([])
    })

    it('keeps the cast countered when the caster declines the counter', async () => {
      const room = await counterspellRoom({ casterCounterspell: true })
      await cast(room)
      await answer(room, REACTOR_ACTOR_ID)

      const { decision } = await offered(room)
      const declined = await room.resolve(decision, { kind: 'DECLINE' })
      expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
      expect(await hitPointsOf(room)).toBe(1)
      expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(1))
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
    })

    it('keeps the cast countered when the caster counters the second holder’s counter of a counter (an odd chain)', async () => {
      const room = await counterspellRoom({ casterCounterspell: true, secondReactor: true })
      const before = await readRoomHistory(room.room.base.stub)
      await cast(room)
      await answer(room, REACTOR_ACTOR_ID)
      // The caster and the second holder are both offered the first counter; each answers in turn.
      const answeredBy: string[] = []
      for (let turn = 0; turn < 2; turn += 1) {
        const { decision, pending } = await offered(room)
        answeredBy.push(pending.targetActorId)
        const answered = await room.resolve(decision, {
          kind: 'OPTION',
          optionId: pending.options[0]!.optionId
        })
        expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
      }
      expect([...answeredBy].sort()).toEqual([CASTER_ACTOR_ID, SECOND_REACTOR_ACTOR_ID].sort())

      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(1)
      expect(await slotsOf(room, CASTER_ID)).toEqual([...SLOT_SPENT(1), ...SLOT_SPENT(3)])
      expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
      expect(await slotsOf(room, SECOND_REACTOR_ID)).toEqual(SLOT_SPENT(3))

      await undoLastAction(room)
      expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
    })

    it('offers the caster no counter when the cast itself takes its last slot able to counter', async () => {
      const room = await counterspellRoom({
        casterCounterspell: true,
        spell: unlimitedCureWounds,
        castLevel: '4th',
        casterSlotsSpent: [3, 5].map((level) => ({ slotKey: `STANDARD:${level}`, used: 1 }))
      })
      await cast(room)
      await answer(room, REACTOR_ACTOR_ID, 1)

      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(await hitPointsOf(room)).toBe(1)
      expect(await slotsOf(room, CASTER_ID)).toEqual(
        [3, 4, 5].map((level) => ({ slotKey: `STANDARD:${level}`, used: 1 }))
      )
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
