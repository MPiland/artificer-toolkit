import { runInDurableObject } from 'cloudflare:test'
import { characterActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { encounterActionPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/encounterActionPending'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { massHealingWord } from '@artificer-toolkit/source-data/srd/spells/mass-healing-word.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readPendingActionContext,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * REACTION-4.1: Shield, held as a reaction, is offered to a creature chosen as a target of Magic
 * Missile before the darts land. Used, it blocks the force damage: the engine knows nothing of
 * either spell, only an authored "you are chosen as a target" trigger and a source-filtered
 * immunity.
 */

const CASTER_ACTOR_ID = testUuid(0x7f0)
const CASTER_ID = testUuid(0x7f1)
const REACTOR_ACTOR_ID = testUuid(0x7f2)
const REACTOR_ID = testUuid(0x7f3)
const REACTOR_HIT_POINTS = 8
// Magic Missile's dart is 1d4+1 and a raw die is its face less one: three darts of 2.
const DARTS_DAMAGE = 3 * 2
const SLOT_SPENT = [{ slotKey: 'STANDARD:1', used: 1 }]
const DARTS = [REACTOR_ACTOR_ID, REACTOR_ACTOR_ID, REACTOR_ACTOR_ID]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** Shield with the cast filter taken off its "chosen as a target" reaction: it answers any cast. */
const unfilteredShield: SpellAuthored = {
  ...shield,
  effects: shield.effects?.map((effect) => {
    const { reactionTrigger } = effect.invocation
    if (reactionTrigger?.kind !== 'TARGETED_SELF') return effect
    const { sourceEffectIds: _filter, ...unfiltered } = reactionTrigger
    return { ...effect, invocation: { ...effect.invocation, reactionTrigger: unfiltered } }
  })
}

/** A Caster who knows `spell`, next to a Character holding `reactorSpell` (or none). */
function targetedRoom(
  options: {
    spell?: SpellAuthored
    label?: string
    reactorSpell?: SpellAuthored | null
    rolls?: readonly number[]
  } = {}
) {
  const {
    spell = magicMissile,
    label = 'Magic Missile (1st level)',
    reactorSpell = shield,
    rolls = [0, 0, 0]
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
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterPlay: { currentHitPoints: 5 },
    secondCharacter: {
      characterId: REACTOR_ID,
      play: { currentHitPoints: REACTOR_HIT_POINTS },
      spellcasting: reactorSpell
        ? { spells: [reactorSpell], prepared: [reactorSpell.id] }
        : undefined
    },
    characterAction: (action) => action.label === label,
    rolls,
    fallbackRoll: 5
  })
}
type Room = Awaited<ReturnType<typeof targetedRoom>>

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
const hitPointsOf = async (room: Room, characterId: string) =>
  (await readPlay(room, characterId)).hitpoints.current
const effectIds = async (room: Room) =>
  (await readRoomHistory(room.room.base.stub)).characterEffects.map(({ id }) => id)

/** The Caster aims `targets`; the room's answer is checked to have committed. */
async function cast(room: Room, targets: readonly string[] = DARTS) {
  const { answer } = await room.startActorsAction(targets, [], true)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The reaction choice the room asks of the targeted Character. */
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

describe('room Shield against Magic Missile (REACTION-4.1)', () => {
  it('holds the darts for the target’s choice, applying and spending nothing', async () => {
    const room = await targetedRoom()
    await cast(room)

    const { pending } = await offered(room)
    expect(pending.targetActorId).toBe(REACTOR_ACTOR_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    expect(await hitPointsOf(room, REACTOR_ID)).toBe(REACTOR_HIT_POINTS)
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect(await effectIds(room)).toEqual([])
  })

  it('seals a targeted-self offer that names its kind, and no other', async () => {
    const room = await targetedRoom()
    await cast(room)
    const context = await readPendingActionContext(room.room.base.stub)
    if (context.kind !== 'ENCOUNTER_ACTION' || !context.castReaction)
      throw new Error('Expected a pending cast reaction.')
    const { castReaction } = context
    expect(castReaction.kind).toBe('TARGETED_SELF')
    expect(castReaction.reactions.map(({ trigger }) => trigger)).toEqual(['TARGETED_SELF'])
    expect(context.rollerActorId).toBe(REACTOR_ACTOR_ID)

    const parses = (value: unknown) =>
      encounterActionPendingContextDtoSchema.safeParse(value).success
    expect(parses(context)).toBe(true)
    expect(parses({ ...context, castReaction: { ...castReaction, kind: 'COUNTER' } })).toBe(false)
  })

  it('blocks the force damage when used: the reaction and slot are spent, and one undo restores everything', async () => {
    const room = await targetedRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await cast(room)
    const { decision, pending } = await offered(room)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await hitPointsOf(room, REACTOR_ID)).toBe(REACTOR_HIT_POINTS)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT)
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT)
    expect(await effectIds(room)).toHaveLength(1)

    await undoLastAction(room)
    expect(await hitPointsOf(room, REACTOR_ID)).toBe(REACTOR_HIT_POINTS)
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    const restored = await readRoomHistory(room.room.base.stub)
    expect(restored.characterEffects).toEqual([])
    expect(restored.actors).toEqual(before.actors)

    // The reaction is back: the same cast offers it again.
    await cast(room)
    await offered(room)
  })

  it('lands the darts when declined, spending only the Caster’s slot', async () => {
    const room = await targetedRoom()
    await cast(room)
    const { decision } = await offered(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await hitPointsOf(room, REACTOR_ID)).toBe(REACTOR_HIT_POINTS - DARTS_DAMAGE)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT)
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect(await effectIds(room)).toEqual([])
  })

  it('commits at once, damage landing, when no chosen target holds the reaction', async () => {
    const room = await targetedRoom({ reactorSpell: null })
    await cast(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await hitPointsOf(room, REACTOR_ID)).toBe(REACTOR_HIT_POINTS - DARTS_DAMAGE)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT)
  })

  it('offers nothing for a cast of another spell: the reaction is limited to Magic Missile', async () => {
    const room = await targetedRoom({
      spell: massHealingWord,
      label: 'Mass Healing Word (3rd level)',
      rolls: [2]
    })
    await cast(room, [REACTOR_ACTOR_ID])
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
  })

  it('offers an unfiltered reaction for a cast of any spell', async () => {
    const room = await targetedRoom({
      spell: massHealingWord,
      label: 'Mass Healing Word (3rd level)',
      rolls: [2],
      reactorSpell: unfilteredShield
    })
    await cast(room, [REACTOR_ACTOR_ID])
    const { pending } = await offered(room)
    expect(pending.targetActorId).toBe(REACTOR_ACTOR_ID)
  })
})
