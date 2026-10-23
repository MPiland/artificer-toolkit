import { runInDurableObject } from 'cloudflare:test'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { maze } from '@artificer-toolkit/source-data/srd/spells/maze.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2h1 (D178): the SRD Maze, a Concentration REMOVE_FROM_PLAY, cast through a real room.
 * While it is held the Wolf is out of play and no one can target it; when the caster's Concentration
 * ends, the Wolf is back in play.
 */

const CHARACTER_ACTOR_ID = testUuid(0x7f0)
const CHARACTER_ID = testUuid(0x7f1)
const WOLF_ID = testUuid(0x7f2)

/** No Scene measures the spell's or the weapon's range (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Character (first in the order) who prepares Maze, and a Wolf to banish. */
async function mazeRoom() {
  const room = await actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // A turn change reads the Character's frozen identity.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    autoRoll: 'BOTH',
    rolls: [14],
    fallbackRoll: 3,
    characterSpellcasting: { spells: [maze], prepared: [maze.id] },
    characterAction: (action) => action.label.startsWith(maze.label)
  })
  const club = (await room.actionChoices()).actions.find(({ label }) => label === 'Club')
  if (!club) throw new Error('The Character offers its Club.')
  return { room, clubActionId: club.id }
}

type MazeRoom = Awaited<ReturnType<typeof mazeRoom>>['room']

const wolfAbsence = (room: MazeRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('encounterRunActors')
      .find(({ id }) => id === WOLF_ID)
    if (!row) throw new Error('Expected the Wolf in the stored Run.')
    return readStoredRunActor(row).absence ?? null
  })

const streamVersionOf = (room: MazeRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return row.streamVersion
  })

/** The GM ends the caster's Concentration through the Character's Sheet. */
async function gmEndsConcentration(room: MazeRoom) {
  const commandId = crypto.randomUUID()
  return room.room.send(commandId, {
    scope: 'CHARACTER_SHEET',
    characterId: CHARACTER_ID,
    encounterId: room.room.encounterId,
    command: {
      type: 'END_CONCENTRATION',
      commandId,
      expectedVersion: await streamVersionOf(room)
    }
  })
}

describe('the SRD Maze in the room (SPELLS-4.T2h1)', () => {
  it('takes the Wolf out of play and untargetable until the Concentration ends', async () => {
    const { room, clubActionId } = await mazeRoom()
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBe('EFFECT')
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toHaveLength(1)

    // An attack on the absent Wolf is refused outright: the warning is no "do it anyway".
    const refused = await room.startAction(WOLF_ID, RANGE, null, null, clubActionId)
    expect(refused.answer.type, JSON.stringify(refused.answer)).toBe('COMMAND_REJECTED')
    expect(refused.answer).not.toMatchObject({ reason: 'RULE_WARNINGS' })

    const ended = await gmEndsConcentration(room)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toEqual([])
    expect(await wolfAbsence(room)).toBeNull()

    // A full round passes, so the Character has an action again, and the Wolf, back in play, has its turn.
    await room.advanceTurn()
    await room.advanceTurn()
    const attack = await room.startAction(WOLF_ID, RANGE, null, null, clubActionId)
    expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
  }, 120000)
})
