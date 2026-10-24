import {
  characterActor,
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { CREATURE_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { applyCreatureAttackRolls } from '@artificer-toolkit/source-data/srd/creatures/attack-rolls.js'
import { giantCentipede } from '@artificer-toolkit/source-data/srd/creatures/giant-centipede.js'
import { giantSpider } from '@artificer-toolkit/source-data/srd/creatures/giant-spider.js'
import { jackal } from '@artificer-toolkit/source-data/srd/creatures/jackal.js'
import { skeleton } from '@artificer-toolkit/source-data/srd/creatures/skeleton.js'
import { polymorph } from '@artificer-toolkit/source-data/srd/spells/polymorph.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'
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

const polymorphRoom = (spell: SpellAuthored = polymorph) =>
  actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      ...WOLF_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    formCreatures: [giantCentipede, giantSpider, skeleton].map(applyCreatureAttackRolls),
    characterAction: (action) => action.label.startsWith(spell.label),
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

    // In the form the Character can cast nothing: the Sheet's actions give way to the form's (T4d).
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
    // Reverting restores the Sheet's actions.
    const restored = (await room.actionChoices()).actions.map((action) => action.label)
    expect(restored.some((label) => label.startsWith(polymorph.label))).toBe(true)
  }, 120000)
})

describe('a form whose effect its holder can end reverts with that end (SPELLS-4.T2s)', () => {
  const UNCONSCIOUS = srdSystemRecord.conditionTypes.find(({ code }) => code === 'UNCONSCIOUS')!.id
  /** Polymorph authored as Wild Shape ends: no Concentration, a bonus action or falling Unconscious. */
  const shedding = ((): SpellAuthored => {
    const [effect] = polymorph.effects ?? []
    const [path] = effect?.paths ?? []
    if (!effect || !path?.resultBlock) throw new Error('Polymorph has no form path.')
    const lifecycle = {
      holderEnd: { activation: 'BONUS_ACTION' as const },
      endOnConditionIds: [UNCONSCIOUS]
    }
    return {
      ...polymorph,
      attributes: [],
      effects: [
        { ...effect, paths: [{ ...path, resultBlock: { ...path.resultBlock, lifecycle } }] }
      ]
    }
  })()
  const characterForm = async (room: PolymorphRoom) =>
    JSON.parse(
      (await readRoomHistory(room.room.base.stub)).actors.find(
        (actor) => actor.id === CHARACTER_ACTOR_ID
      )!.stateJson
    ).form as { effectId: string } | null

  async function inForm() {
    const room = await polymorphRoom(shedding)
    const { answer } = await castAt(room, [CHARACTER_ACTOR_ID], CREATURE_IDS.GIANT_CENTIPEDE)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerSave(room, FAIL)
    const form = await characterForm(room)
    if (!form) throw new Error('The Character took no form.')
    return { room, effectId: form.effectId }
  }

  it('reverts the Character when it ends the form as a bonus action', async () => {
    const { room, effectId } = await inForm()
    const ended = await room.send({
      type: 'END_HELD_GRANT',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: CHARACTER_ACTOR_ID,
      activeEffectId: effectId,
      acknowledgedWarnings: []
    })
    if (ended.type !== 'COMMAND_COMMITTED' || ended.delta?.scope !== 'ENCOUNTER')
      throw new Error(`Expected the committed end: ${JSON.stringify(ended)}`)
    expect(await characterForm(room)).toBeNull()
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toEqual([])
    // The answer the GM reads shows the Character out of its form, not the stale form.
    const shown = ended.delta.result.projection.actors.find(({ id }) => id === CHARACTER_ACTOR_ID)
    if (shown?.kind !== 'CHARACTER') throw new Error('The answer shows no Character actor.')
    expect(shown.form).toBeNull()
  }, 120000)

  it('reverts the Character when a Sheet edit leaves it Unconscious', async () => {
    const { room } = await inForm()
    const streamVersion = await runInDurableObject(
      room.room.base.stub,
      (_instance, context) =>
        new RoomEncounterStore(context.storage)
          .documents('characterPlayStates')
          .find((row) => row.characterId === CHARACTER_ID)!.streamVersion
    )
    const commandId = crypto.randomUUID()
    const edited = await room.room.send(commandId, {
      scope: 'CHARACTER_SHEET',
      characterId: CHARACTER_ID,
      encounterId: room.room.encounterId,
      command: {
        type: 'ADD_CONDITION',
        conditionTypeId: UNCONSCIOUS,
        commandId,
        expectedVersion: streamVersion
      }
    })
    expect(edited.type, JSON.stringify(edited)).toBe('COMMAND_COMMITTED')
    expect(await characterForm(room)).toBeNull()
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toEqual([])
  }, 120000)
})

describe("a Character in a form attacks with the form's stat block (SPELLS-28.T4d)", () => {
  const FORM_EFFECT_ID = testUuid(0x8d4)
  const FORM_ACTOR_ID = testUuid(0x8d5)

  /** The Character already wearing the Jackal's form; every attack d20 shows 15 (a hit) and d4 shows 2. */
  const formRoom = () => {
    const creature = srdCreatureActor({
      id: FORM_ACTOR_ID,
      creature: installedSrdCreature(jackal)
    })
    if (creature.kind !== 'CREATURE' || !creature.sourceId || !creature.sourceRevision)
      throw new Error('Expected a Creature actor.')
    const character = characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    if (character.kind !== 'CHARACTER') throw new Error('Expected a Character actor.')
    return actionRoom({
      autoRoll: 'BOTH',
      rolls: Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? 14 : 1)),
      actors: [
        {
          ...character,
          snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id },
          form: {
            effectId: FORM_EFFECT_ID,
            excessDamageCarriesOver: true,
            sourceId: creature.sourceId,
            sourceRevision: creature.sourceRevision,
            snapshot: creature.snapshot,
            currentHitPoints: creature.currentHitPoints,
            maxHitPoints: creature.maxHitPoints,
            tempHitPoints: 0
          }
        },
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      characterAction: (action) => action.label.startsWith('Bite')
    })
  }

  it("resolves the form's Bite on a target and hurts it", async () => {
    const room = await formRoom()
    const before = JSON.parse(
      (await readRoomHistory(room.room.base.stub)).actors.find((actor) => actor.id === WOLF_ID)!
        .stateJson
    ).currentHitPoints

    const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = JSON.parse(
      (await readRoomHistory(room.room.base.stub)).actors.find((actor) => actor.id === WOLF_ID)!
        .stateJson
    ).currentHitPoints
    expect(after).toBeLessThan(before)
  }, 120000)
})
