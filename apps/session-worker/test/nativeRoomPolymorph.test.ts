import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { CREATURE_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { applyCreatureAttackRolls } from '@artificer-toolkit/source-data/srd/creatures/attack-rolls.js'
import { giantCentipede } from '@artificer-toolkit/source-data/srd/creatures/giant-centipede.js'
import { giantSpider } from '@artificer-toolkit/source-data/srd/creatures/giant-spider.js'
import { skeleton } from '@artificer-toolkit/source-data/srd/creatures/skeleton.js'
import { polymorph } from '@artificer-toolkit/source-data/srd/spells/polymorph.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

const CHARACTER_ACTOR_ID = testUuid(0x8d0)
const CHARACTER_ID = testUuid(0x8d1)
const WOLF_IDS = [0x8d2, 0x8d3].map(testUuid)
const [WOLF_ID] = WOLF_IDS as [string, string]
const RANGE_UNCHECKED: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
const FAIL = 1
const SAVE = 20

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const polymorphRoom = () =>
  actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      ...WOLF_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    characterSpellcasting: { spells: [polymorph], prepared: [polymorph.id] },
    formCreatures: [giantCentipede, giantSpider, skeleton].map(applyCreatureAttackRolls),
    characterAction: (action) => action.label.startsWith(polymorph.label),
    rolls: [],
    fallbackRoll: 5
  })

type PolymorphRoom = Awaited<ReturnType<typeof polymorphRoom>>

/** What the room stores of the wolf, as the form swap and its undo must restore it exactly. */
const wolfRow = (history: RoomHistory) => {
  const row = history.actors.find((actor) => actor.id === WOLF_ID)!
  return {
    stateJson: row.stateJson,
    stateChecksum: row.stateChecksum,
    snapshotChecksum: row.snapshotChecksum,
    formOriginSnapshotChecksum: row.formOriginSnapshotChecksum,
    sourceFactsChecksum: row.sourceFactsChecksum
  }
}

const castAt = (room: PolymorphRoom, actorIds: readonly string[], creatureId?: string) =>
  room.startActorsAction(actorIds, RANGE_UNCHECKED, false, null, undefined, creatureId)

async function answerSave(room: PolymorphRoom, face: number) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
  const [save] = decision.pending.saves
  if (!save) throw new Error('The wolf has no pending save.')
  const answer = await room.send(
    room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: save.request.requestId,
      rawFaces: [face],
      rollMode: save.request.rollMode
    })
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('Polymorph turns a creature that fails its save into a beast it is not too weak for (SPELLS-28.1)', () => {
  it('swaps the wolf into the chosen beast on a failed save, and undoes the cast byte for byte', async () => {
    const room = await polymorphRoom()
    const before = wolfRow(await readRoomHistory(room.room.base.stub))

    const { answer } = await castAt(room, [WOLF_ID], CREATURE_IDS.GIANT_CENTIPEDE)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    // The form waits on the target's own save: nothing has changed yet.
    expect(wolfRow(await readRoomHistory(room.room.base.stub))).toEqual(before)
    await answerSave(room, FAIL)

    const cast = await readRoomHistory(room.room.base.stub)
    const effect = cast.activeEffects.find((candidate) => candidate.targetActorId === WOLF_ID)!
    expect(JSON.parse(cast.actors.find((actor) => actor.id === WOLF_ID)!.stateJson)).toMatchObject({
      sourceId: CREATURE_IDS.GIANT_CENTIPEDE,
      currentHitPoints: giantCentipede.hitPoints,
      form: { effectId: effect.id, excessDamageCarriesOver: true }
    })
    expect(JSON.parse(effect.definitionJson).stateContributions).toEqual([
      expect.objectContaining({
        kind: 'CREATURE_FORM',
        creatureId: CREATURE_IDS.GIANT_CENTIPEDE,
        excessDamageCarriesOver: true
      })
    ])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const reverted = await readRoomHistory(room.room.base.stub)
    expect(reverted.activeEffects).toHaveLength(0)
    expect(wolfRow(reverted)).toEqual(before)
  }, 120000)

  it('leaves the wolf as it was when its save succeeds', async () => {
    const room = await polymorphRoom()
    const before = wolfRow(await readRoomHistory(room.room.base.stub))

    const { answer } = await castAt(room, [WOLF_ID], CREATURE_IDS.GIANT_CENTIPEDE)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerSave(room, SAVE)

    const saved = await readRoomHistory(room.room.base.stub)
    expect(saved.activeEffects).toHaveLength(0)
    expect(wolfRow(saved)).toEqual(before)
  }, 120000)

  // A Character took no form before the D130 amendment (T4c); it now takes one, so it is no longer refused.
  it('refuses a form too powerful, not a beast, no form, and more than one creature', async () => {
    const room = await polymorphRoom()
    const refusedWith = async (actorIds: readonly string[], creatureId?: string) => {
      const { answer } = await castAt(room, actorIds, creatureId)
      expect(answer.type).toBe('COMMAND_REJECTED')
      return JSON.stringify(answer)
    }

    expect(await refusedWith([WOLF_ID], CREATURE_IDS.GIANT_SPIDER)).toContain('too powerful')
    expect(await refusedWith([WOLF_ID], CREATURE_IDS.SKELETON)).toContain('not a type')
    expect(await refusedWith([WOLF_ID])).toContain('needs one of its creature forms')
    expect(await refusedWith(WOLF_IDS, CREATURE_IDS.GIANT_CENTIPEDE)).toContain('at most 1')
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toHaveLength(0)
  }, 120000)
})

describe("Polymorph turns a Character into a beast and keeps what is the Character's (SPELLS-28.1, D130 amendment)", () => {
  const characterRow = (history: RoomHistory) =>
    history.actors.find((actor) => actor.id === CHARACTER_ACTOR_ID)!

  it('gives the Character the form on a failed save, refuses casting in it, and undoes the cast byte for byte', async () => {
    const room = await polymorphRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const sheetBefore = before.characterEffects

    const { answer } = await castAt(room, [CHARACTER_ACTOR_ID], CREATURE_IDS.GIANT_CENTIPEDE)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerSave(room, FAIL)

    const cast = await readRoomHistory(room.room.base.stub)
    expect(JSON.parse(characterRow(cast).stateJson)).toMatchObject({
      kind: 'CHARACTER',
      form: {
        effectId: expect.any(String),
        sourceId: CREATURE_IDS.GIANT_CENTIPEDE,
        currentHitPoints: giantCentipede.hitPoints,
        maxHitPoints: giantCentipede.hitPoints,
        excessDamageCarriesOver: true
      }
    })
    // The caster concentrates on the form; Concentration stays while the form is worn.
    expect(cast.maintainedStates.length).toBeGreaterThan(0)

    // In the form the Character can cast nothing.
    const offered = await room.actionChoices()
    expect(offered.actions.some((action) => action.label.startsWith(polymorph.label))).toBe(false)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const reverted = await readRoomHistory(room.room.base.stub)
    expect(reverted.activeEffects).toHaveLength(0)
    expect(JSON.parse(characterRow(reverted).stateJson).form).toBeNull()
    expect(reverted.characterEffects).toEqual(sheetBefore)
  }, 120000)
})
