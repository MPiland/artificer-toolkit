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
import { imprisonment } from '@artificer-toolkit/source-data/srd/spells/imprisonment.js'
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
 * other actors the case stands on the Scene. `rolls` are the room's next zero-based dice.
 */
async function spellRoom(
  spell: typeof maze,
  positions?: Record<string, { x: number; y: number }>,
  others: readonly EncounterRunActorState[] = [],
  rolls: readonly number[] = [14]
) {
  const room = await actionRoom({
    ...(positions && { positions }),
    actors: [character, srdCreatureActor({ id: WOLF_ID, creature: plainWolf }), ...others],
    autoRoll: 'BOTH',
    rolls,
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

const streamVersionOf = (room: MazeRoom, characterId = CHARACTER_ID) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === characterId)
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

/** The GM ends `characterId`'s one active effect through that Character's Sheet. */
async function gmEndsActiveEffect(room: MazeRoom, characterId: string) {
  const [effect] = (await readRoomHistory(room.room.base.stub)).characterEffects.filter(
    (row) => row.characterId === characterId
  )
  if (!effect) throw new Error('Expected the Character to hold an active effect.')
  const commandId = crypto.randomUUID()
  return room.room.send(commandId, {
    scope: 'CHARACTER_SHEET',
    characterId,
    encounterId: room.room.encounterId,
    command: {
      type: 'END_ACTIVE_EFFECT',
      commandId,
      expectedVersion: await streamVersionOf(room, characterId),
      effectId: effect.id
    }
  })
}

/** The GM ends the one active effect the Run actor `actorId` holds, from the encounter drawer. */
async function gmEndsActorEffect(room: MazeRoom, actorId: string) {
  const [effect] = (await readRoomHistory(room.room.base.stub)).activeEffects.filter(
    (row) => row.targetActorId === actorId
  )
  if (!effect) throw new Error('Expected the actor to hold an active effect.')
  return room.send({
    type: 'UPDATE_ACTOR',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId,
    endActiveEffectId: effect.id
  })
}

/** The Wolf's active grants in the GM projection a committed Encounter command answers with. */
function wolfGrants(answer: Awaited<ReturnType<MazeRoom['send']>>) {
  if (answer.type !== 'COMMAND_COMMITTED' || answer.delta?.scope !== 'ENCOUNTER')
    throw new Error(`Expected a committed Encounter command: ${JSON.stringify(answer)}`)
  return answer.delta.result.projection.actors.find(({ id }) => id === WOLF_ID)?.activeGrants
}

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
      summon: {
        kind: 'STAT_BLOCK',
        statBlock: { occupiesSpace: false, hitPoints: { kind: 'FIXED', value: 10 } }
      },
      spellSummon: null,
      caster: character,
      casterHitPointMaximum: 20,
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
    // A natural 1. The default 15 made the Wolf's save (QUALITY-15.T3u): only the ungated removal
    // took it out of play.
    const { room } = await spellRoom(banishment, undefined, [], [0])
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBe('EFFECT')

    const ended = await gmEndsConcentration(room)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBeNull()
  }, 120000)

  it('Imprisonment removes a Wolf that fails its save until the GM ends it from the drawer (QUALITY-15.T3ae, T3af)', async () => {
    // A natural 1.
    const { room } = await spellRoom(imprisonment, undefined, [], [0])
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBe('EFFECT')
    // The drawer lists the removal by its spell, with End.
    const [stored] = (await readRoomHistory(room.room.base.stub)).activeEffects
    expect(wolfGrants(cast.answer)).toEqual([
      expect.objectContaining({
        effectId: stored?.id,
        label: 'Imprisonment (9th level)',
        endable: true
      })
    ])

    const ended = await gmEndsActorEffect(room, WOLF_ID)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBeNull()
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toEqual([])
    expect(wolfGrants(ended)).toEqual([])
  }, 120000)

  it('refuses the GM ending a Maze its Concentration maintains on a Wolf (QUALITY-15.T3ae)', async () => {
    const { room } = await spellRoom(maze)
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')

    const refused = await gmEndsActorEffect(room, WOLF_ID)
    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect(await wolfAbsence(room)).toBe('EFFECT')
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toHaveLength(1)
  }, 120000)

  it('Etherealness takes the caster out of play and keeps their turn (T2h4)', async () => {
    const { room } = await spellRoom(etherealness)
    const cast = await room.startAction(CHARACTER_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await absenceOf(room, CHARACTER_ACTOR_ID)).toBe('EFFECT_KEEPS_TURN')

    const ended = await gmEndsActiveEffect(room, CHARACTER_ID)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await absenceOf(room, CHARACTER_ACTOR_ID)).toBeNull()
  }, 120000)

  it('Banishment leaves a Wolf that makes its save in play (QUALITY-15.T3u)', async () => {
    // A natural 20.
    const { room } = await spellRoom(banishment, undefined, [], [19])
    const cast = await room.startAction(WOLF_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfAbsence(room)).toBeNull()
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toEqual([])
  }, 120000)

  it('Imprisonment removes a Character that fails its save until the GM ends it (QUALITY-15.T3u)', async () => {
    const TARGET_ACTOR_ID = testUuid(0x7f4)
    const TARGET_CHARACTER_ID = testUuid(0x7f5)
    const room = await actionRoom({
      actors: [
        character,
        characterActor({ id: TARGET_ACTOR_ID, characterId: TARGET_CHARACTER_ID })
      ],
      autoRoll: 'BOTH',
      rolls: [0],
      fallbackRoll: 3,
      characterSpellcasting: { spells: [imprisonment], prepared: [imprisonment.id] },
      characterAction: (action) => action.label.startsWith(imprisonment.label),
      secondCharacter: { characterId: TARGET_CHARACTER_ID }
    })
    const cast = await room.startAction(TARGET_ACTOR_ID, RANGE)
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    // The target's player rolls its save: a natural 1 fails it.
    const save = await room.pendingDecision()
    expect((await room.rollDice(save)).type).toBe('COMMAND_COMMITTED')
    const held = (await readRoomHistory(room.room.base.stub)).evidenceRolls.at(-1)
    if (!held || !('request' in save.pending)) throw new Error('The save roll was not held.')
    const settled = await room.resolve(save, {
      kind: 'SYSTEM_ROLL',
      requestId: save.pending.request.requestId,
      rollId: held.id
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect(await absenceOf(room, TARGET_ACTOR_ID)).toBe('EFFECT')

    const ended = await gmEndsActiveEffect(room, TARGET_CHARACTER_ID)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')
    expect(await absenceOf(room, TARGET_ACTOR_ID)).toBeNull()
  }, 120000)
})
