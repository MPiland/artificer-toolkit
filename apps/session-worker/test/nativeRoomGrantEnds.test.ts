import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-5.4 ends on the movement-room paths: a reaction attack uses a grant up, and a source's
 * departure or skipped turn ends the grants anchored to it.
 */

const MOVER_ID = testUuid(0x200)
const REACTOR_ID = testUuid(0x201)
const HOLDER_ID = testUuid(0x202)
const CHARACTER_ID = testUuid(0x400)
const MOVER_START = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type Room = Awaited<ReturnType<typeof movementRoom>>

const activeEffects = async (room: Room) => (await readRoomHistory(room.base.stub)).activeEffects

async function sendEncounterCommand(room: Room, command: Record<string, unknown>) {
  const [run] = (await readRoomHistory(room.base.stub)).runs
  const commandId = crypto.randomUUID()
  const answer = await room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      ...command,
      encounterId: room.encounterId,
      commandId,
      expectedVersion: run!.version
    }
  })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

async function moveIntoReaction(room: Room) {
  await room.move([MOVER_START, { x: 450, y: 150 }])
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  const option = pending.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  await room.respond({ kind: 'OPTION', optionId: option.optionId })
}

function reactionRoom() {
  return movementRoom({
    actors: [
      characterActor({ id: MOVER_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf })
    ],
    moverActorId: MOVER_ID,
    positions: { [MOVER_ID]: MOVER_START, [REACTOR_ID]: { x: 50, y: 150 } },
    characterPlay: { currentHitPoints: 20 },
    autoRoll: 'BOTH',
    rolls: [14],
    fallbackRoll: 0,
    seed: seedModifierGrant({
      sourceActorId: MOVER_ID,
      holderActorId: REACTOR_ID,
      lifecycle: { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] }
    })
  })
}

describe('a reaction attack uses up the attacker’s one-roll grants (SPELLS-5.4)', () => {
  it('deletes the grant its opportunity attack rolled against', async () => {
    const room = await reactionRoom()
    expect(await activeEffects(room)).toHaveLength(1)

    await moveIntoReaction(room)

    expect(await activeEffects(room)).toEqual([])
  })
})

describe('a grant anchored to a source that is gone (SPELLS-5.4)', () => {
  function sourceGrantRoom(sourceDefeated: boolean) {
    // Initiative reads the Character's frozen identity, which a turn change checks.
    const mover = {
      ...characterActor({ id: MOVER_ID, characterId: CHARACTER_ID }),
      snapshot: { kind: 'CHARACTER' as const, id: CHARACTER_ID, systemId: srdSystemRecord.id }
    }
    return movementRoom({
      actors: [
        mover,
        srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf, defeated: sourceDefeated }),
        srdCreatureActor({ id: HOLDER_ID, creature: reactionWolf })
      ],
      moverActorId: MOVER_ID,
      positions: {
        [MOVER_ID]: MOVER_START,
        [REACTOR_ID]: { x: 50, y: 150 },
        [HOLDER_ID]: { x: 250, y: 150 }
      },
      characterPlay: { currentHitPoints: 20 },
      seed: seedModifierGrant({
        sourceActorId: REACTOR_ID,
        holderActorId: HOLDER_ID,
        lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } }
      })
    })
  }

  it('ends with its source’s removal from the Run', async () => {
    const room = await sourceGrantRoom(false)
    expect(await activeEffects(room)).toMatchObject([{ targetActorId: HOLDER_ID }])

    await sendEncounterCommand(room, { type: 'REMOVE_ACTOR', actorId: REACTOR_ID })

    expect(await activeEffects(room)).toEqual([])
  })

  it('expires when its defeated source’s skipped turn passes', async () => {
    const room = await sourceGrantRoom(true)
    expect(await activeEffects(room)).toHaveLength(1)

    await sendEncounterCommand(room, { type: 'ADVANCE_TURN' })

    expect(await activeEffects(room)).toEqual([])
  })
})
