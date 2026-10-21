import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { counterspell } from '@artificer-toolkit/source-data/srd/spells/counterspell.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionContext } from './roomHistoryReads.js'

/**
 * REACTION-4.T3h (D136): a Creature capability that casts a spell offers a held Counterspell at the
 * level it is cast at, and one that casts no spell, a spell attack included, offers none.
 */

const CASTER_ACTOR_ID = testUuid(0x7e0)
const VICTIM_ACTOR_ID = testUuid(0x7e1)
const VICTIM_ID = testUuid(0x7e2)
const REACTOR_ACTOR_ID = testUuid(0x7e3)
const REACTOR_ID = testUuid(0x7e4)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf whose Bite (a save, at any range) is cast at `spellCast`, and a Character holding Counterspell. */
function creatureCastRoom(spellCast?: { castLevel: number }) {
  const bite = biteWolf('SAVE', { spellCast })
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
      srdCreatureActor({ id: CASTER_ACTOR_ID, creature: bite }),
      characterActor({ id: VICTIM_ACTOR_ID, characterId: VICTIM_ID }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    characterPlay: { currentHitPoints: 5 },
    secondCharacter: {
      characterId: REACTOR_ID,
      spellcasting: { spells: [counterspell], prepared: [counterspell.id] }
    },
    ownerFeatureId: creatureFeature(bite, 'Bite').id
  })
}
type Room = Awaited<ReturnType<typeof creatureCastRoom>>

const reactorSlots = (room: Room) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === REACTOR_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).spellSlots ?? []
  })

describe('room Counterspell against a Creature capability cast (REACTION-4.1)', () => {
  it('offers the holder a counter to a capability that casts a spell, spending nothing yet', async () => {
    const room = await creatureCastRoom({ castLevel: 4 })
    const { answer } = await room.startAction(VICTIM_ACTOR_ID, [], room.sceneContext(1))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const decision = await room.pendingDecision()
    expect(decision.pending.kind).toBe('REACTION_CHOICE')
    if (decision.pending.kind !== 'REACTION_CHOICE') return
    expect(decision.pending.targetActorId).toBe(REACTOR_ACTOR_ID)
    expect(await reactorSlots(room)).toEqual([])
  })

  it('owes the higher-level check at the capability’s cast level', async () => {
    const room = await creatureCastRoom({ castLevel: 4 })
    await room.startAction(VICTIM_ACTOR_ID, [], room.sceneContext(1))
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'REACTION_CHOICE') throw new Error('Expected the counter offer.')
    // The first option is the 3rd-level slot, one below the 4th-level cast.
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: decision.pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const context = await readPendingActionContext(room.room.base.stub)
    if (
      context.kind !== 'ENCOUNTER_ACTION' ||
      context.pause?.kind !== 'CAST_REACTION' ||
      !context.pause.payload.check
    )
      throw new Error('Expected a pending counter check.')
    expect(context.pause.payload.check).toMatchObject({ triggerLevel: 4, dc: 14 })
  })

  it('offers no counter to a capability that casts no spell', async () => {
    const room = await creatureCastRoom()
    const { answer } = await room.startAction(VICTIM_ACTOR_ID, [], room.sceneContext(1))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await room.pendingDecision()).pending.kind).not.toBe('REACTION_CHOICE')
  })
})
