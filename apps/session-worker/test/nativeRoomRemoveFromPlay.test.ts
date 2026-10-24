import { runInDurableObject } from 'cloudflare:test'
import { presentTimelineEntry } from '@artificer-toolkit/encounter-persistence/timelineEntries'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { buildEncounterSummon } from '@artificer-toolkit/rules-runtime/encounterSummon'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { banishment } from '@artificer-toolkit/source-data/srd/spells/banishment.js'
import { etherealness } from '@artificer-toolkit/source-data/srd/spells/etherealness.js'
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

const character = {
  ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
  // A turn change reads the Character's frozen identity.
  snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
}

/**
 * The Character (first in the order) who prepares `spell`, a Wolf to remove from play, and any
 * other actors the case stands on the Scene.
 */
async function spellRoom(
  spell: typeof maze,
  positions?: Record<string, { x: number; y: number }>,
  others: readonly EncounterRunActorState[] = []
) {
  const room = await actionRoom({
    ...(positions && { positions }),
    actors: [character, srdCreatureActor({ id: WOLF_ID, creature: plainWolf }), ...others],
    autoRoll: 'BOTH',
    rolls: [14],
    fallbackRoll: 3,
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label.startsWith(spell.label)
  })
  const club = (await room.actionChoices()).actions.find(({ label }) => label === 'Club')
  if (!club) throw new Error('The Character offers its Club.')
  return { room, clubActionId: club.id }
}

type MazeRoom = Awaited<ReturnType<typeof spellRoom>>['room']

const absenceOf = (room: MazeRoom, actorId: string) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('encounterRunActors')
      .find(({ id }) => id === actorId)
    if (!row) throw new Error('Expected the actor in the stored Run.')
    return readStoredRunActor(row).absence ?? null
  })

const wolfAbsence = (room: MazeRoom) => absenceOf(room, WOLF_ID)

const streamVersionOf = (room: MazeRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return row.streamVersion
  })

/** The GM-only history entries that flag a creature returned onto an occupied space. */
const returnEntries = async (room: MazeRoom) =>
  (await readRoomHistory(room.room.base.stub)).commands
    .filter(({ commandType }) => commandType === 'RETURNED_TO_PLAY')
    .map(({ _id, _creationTime, ...row }) =>
      presentTimelineEntry(encounterStoredRunCommandSchema.parse(row))
    )
    .map(({ label, ruleOverrides }) => ({ label, ruleOverrides }))

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
    const { room, clubActionId } = await spellRoom(maze)
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

  it('flags a return onto an occupied space for the GM and leaves the Scene alone (D184)', async () => {
    // The Wolf's token sits on the Character's, so when the Maze ends there is no free cell for it.
    const { room } = await spellRoom(maze, {
      [CHARACTER_ACTOR_ID]: { x: 150, y: 150 },
      [WOLF_ID]: { x: 150, y: 150 }
    })
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await returnEntries(room)).toEqual([])

    const ended = await gmEndsConcentration(room)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBeNull()
    const entries = await returnEntries(room)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      label: expect.stringContaining('returned to play onto an occupied space'),
      ruleOverrides: [{ code: 'RETURN_SPACE_OCCUPIED' }]
    })
  }, 120000)

  it('flags nothing when the Wolf returns onto a summon that does not occupy its space (SPELLS-4.T2v2a3c)', async () => {
    // Owned with no carrier effect, so the orphan sweep after each command keeps it on the Scene.
    const { actor: conjured } = buildEncounterSummon({
      summon: { statBlock: { occupiesSpace: false, hitPoints: { kind: 'FIXED', value: 10 } } },
      caster: character,
      casterHitPointMaximum: null,
      label: 'Conjured',
      sourceEffectId: testUuid(0x7f3),
      point: { x: 450, y: 150 },
      edgeLength: 100,
      occurredAt: new Date().toISOString()
    })
    const summon = { ...conjured, owner: { ownerActorId: character.id } }
    const { room } = await spellRoom(
      maze,
      { [WOLF_ID]: { x: 450, y: 150 }, [summon.id]: { x: 450, y: 150 } },
      [summon]
    )
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    const ended = await gmEndsConcentration(room)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBeNull()
    expect(await absenceOf(room, summon.id)).toBeNull()
    expect(await returnEntries(room)).toEqual([])
  }, 120000)

  it('flags nothing when the returning creature has its own space', async () => {
    const { room } = await spellRoom(maze)
    await room.startAction(WOLF_ID, RANGE)
    const ended = await gmEndsConcentration(room)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBeNull()
    expect(await returnEntries(room)).toEqual([])
  }, 120000)

  it('Banishment removes a Wolf that fails its save and returns it when the Concentration ends (T2h4)', async () => {
    const { room } = await spellRoom(banishment)
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBe('EFFECT')

    const ended = await gmEndsConcentration(room)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBeNull()
  }, 120000)

  it('Etherealness takes the caster out of play and keeps their turn (T2h4)', async () => {
    const { room } = await spellRoom(etherealness)
    const cast = await room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await absenceOf(room, CHARACTER_ACTOR_ID)).toBe('EFFECT_KEEPS_TURN')

    const [effect] = (await readRoomHistory(room.room.base.stub)).characterEffects
    const commandId = crypto.randomUUID()
    const ended = await room.room.send(commandId, {
      scope: 'CHARACTER_SHEET',
      characterId: CHARACTER_ID,
      encounterId: room.room.encounterId,
      command: {
        type: 'END_ACTIVE_EFFECT',
        commandId,
        expectedVersion: await streamVersionOf(room),
        effectId: effect!.id
      }
    })
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await absenceOf(room, CHARACTER_ACTOR_ID)).toBeNull()
  }, 120000)
})
