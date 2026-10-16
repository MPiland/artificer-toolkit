import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { cureWounds } from '@artificer-toolkit/source-data/srd/spells/cure-wounds.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { SRD_CREATURE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

const CHARACTER_ACTOR_ID = testUuid(0x7c0)
const CHARACTER_ID = testUuid(0x7c1)
const CAUGHT_IDS = [testUuid(0x7c2), testUuid(0x7c3)]
const OUT_OF_REACH_ID = testUuid(0x7c8)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** Fireball's point sphere and Dexterity save, at 1st level and dealing a fixed 1 damage. */
const emberBurst: SpellAuthored = (() => {
  const spell = structuredClone(fireball)
  const path = spell.effects![0]!.paths![0]!
  if (!('resultBlock' in path)) throw new Error('Fireball has a result block.')
  const outcome = path.resultBlock.outcomes![0]!
  if (outcome.effectKind !== 'DAMAGE' || outcome.damageTypeId === undefined)
    throw new Error('Fireball deals damage.')
  path.resultBlock.outcomes = [
    {
      id: outcome.id,
      effectKind: 'DAMAGE',
      damageTypeId: outcome.damageTypeId,
      valueKind: 'FIXED',
      scalingKind: 'NONE',
      amount: 1
    }
  ]
  return { ...spell, id: testUuid(0x7c4), label: 'Ember Burst', level: 1 }
})()

/** A Character knowing and preparing the burst, with two Wolves in reach of a 20 ft sphere at x = 50. */
function spellCasterRoom(spell: SpellAuthored = emberBurst, label = 'Ember Burst (1st level)') {
  return actionRoom({
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf }),
      srdCreatureActor({ id: CAUGHT_IDS[1]!, creature: plainWolf })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label === label
  })
}

type SpellCasterRoom = Awaited<ReturnType<typeof spellCasterRoom>>

/** The Character's spent spell slots as the Sheet's play state records them. */
const readSpellSlots = (room: SpellCasterRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).spellSlots ?? []
  })

const readHitPoints = (room: SpellCasterRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).hitpoints.current
  })

/** Answers every save the area still waits on with a failing 1. */
async function answerAllSaves(room: SpellCasterRoom) {
  for (;;) {
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (decision?.pending.kind !== 'AREA_SAVES') return
    const [save] = decision.pending.saves
    if (!save) return
    const answer = await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [1],
        rollMode: save.request.rollMode
      })
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  }
}

/** The burst dealing 1d4 at 1st level and 3d4 when cast with a 2nd-level slot. */
const scaledBurst: SpellAuthored = (() => {
  const spell = structuredClone(emberBurst)
  const outcome = spell.effects![0]!.paths![0]! as {
    resultBlock: { outcomes: Record<string, unknown>[] }
  }
  const [first] = outcome.resultBlock.outcomes
  outcome.resultBlock.outcomes = [
    {
      ...first,
      valueKind: 'DICE',
      scalingKind: 'PER_LEVEL',
      scalingSource: 'SPELL_CAST_LEVEL',
      levels: [
        { id: testUuid(0x7d0), level: 1, order: 1, diceConfig: '1d4' },
        { id: testUuid(0x7d1), level: 2, order: 2, diceConfig: '3d4' }
      ]
    }
  ]
  delete first!.amount
  return { ...spell, id: testUuid(0x7c6), label: 'Scaled Burst' }
})()

const SLOT_SPENT = [{ slotKey: 'STANDARD:1', used: 1 }]

const spellSpend = {
  characterId: CHARACTER_ID,
  spellId: emberBurst.id,
  slotKey: 'STANDARD:1',
  beforeUsed: 0,
  afterUsed: 1
}

async function undoLastAction(room: SpellCasterRoom) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

describe('room point-area spell cast by a Character', () => {
  it('spends the slot on the root alone when the area catches nobody, and one undo restores it', async () => {
    const room = await spellCasterRoom()
    expect(await readSpellSlots(room)).toEqual([])

    const { command, answer } = await room.startAreaAction({ x: 150, y: 2000 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(roots[0]?.receipt.commandId).toBe(command.commandId)
    expect(roots[0]?.outputs.spellCastConsumption).toMatchObject(spellSpend)
    expect(children).toEqual([])
    expect(await readSpellSlots(room)).toEqual(SLOT_SPENT)

    await undoLastAction(room)
    expect(await readSpellSlots(room)).toEqual([])
  })

  it("spends the slot once with the caster's own outcome when the area catches the caster", async () => {
    const room = await spellCasterRoom()

    const { command, answer } = await room.startAreaAction({ x: 50, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(roots[0]?.receipt.commandId).toBe(command.commandId)
    expect(roots[0]?.outputs.spellCastConsumption).toMatchObject(spellSpend)
    // The area catches the Character and both Wolves; the caster's own outcome writes its Sheet,
    // so that one batch carries the spend and no other does.
    expect(children).toHaveLength(CAUGHT_IDS.length + 1)
    expect(
      children.flatMap(({ outputs }) =>
        outputs.kind === 'CHARACTER_MECHANICS_BATCH' ? [outputs.spellCastConsumption] : []
      )
    ).toEqual([expect.objectContaining(spellSpend)])
    expect(await readSpellSlots(room)).toEqual(SLOT_SPENT)

    await undoLastAction(room)
    expect(await readSpellSlots(room)).toEqual([])
  })
})

describe('room upcast point-area spell cast by a Character', () => {
  it('spends the higher slot and rolls the higher-level damage', async () => {
    const room = await spellCasterRoom(scaledBurst, 'Scaled Burst (2nd level)')
    const { answer } = await room.startAreaAction({ x: 50, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(roots[0]?.outputs.spellCastConsumption).toMatchObject({
      slotKey: 'STANDARD:2',
      beforeUsed: 0,
      afterUsed: 1
    })
    // The room rolls every die as 1, so the 2nd-level 3d4 deals 3 where the 1st-level 1d4 would deal 1.
    const damage = children.flatMap(({ outputs }) =>
      outputs.applications.filter((application) => application.kind === 'DAMAGE')
    )
    expect(damage).toHaveLength(CAUGHT_IDS.length + 1)
    expect(damage.every((application) => application.requestedAmount === 3)).toBe(true)
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:2', used: 1 }])

    await undoLastAction(room)
    expect(await readSpellSlots(room)).toEqual([])
  })
})

/** Cure Wounds with no Scene geometry, healing a fixed 2. */
const mend: SpellAuthored = (() => {
  const spell = structuredClone(cureWounds)
  for (const effect of spell.effects ?? []) {
    if (effect.invocation.kind !== 'ACTION') continue
    effect.invocation.range = { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' }
    effect.invocation.targeting = { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
  }
  const path = spell.effects?.[0]?.paths?.[0]
  const outcome = path && 'resultBlock' in path ? path.resultBlock.outcomes?.[0] : undefined
  if (outcome?.effectKind !== 'HEAL') throw new Error('Cure Wounds heals.')
  Object.assign(outcome, { valueKind: 'FIXED', scalingKind: 'NONE', amount: 2 })
  for (const key of ['diceConfig', 'levels', 'scalingSource', 'bonuses'])
    delete (outcome as Record<string, unknown>)[key]
  return { ...spell, id: testUuid(0x7c5), label: 'Mend', level: 1 }
})()

describe('room single-target spell cast by a Character', () => {
  it('spends the slot with the heal in one Character version, and one undo restores both', async () => {
    const room = await actionRoom({
      actors: [characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })],
      characterSpellcasting: { spells: [mend], prepared: [mend.id] },
      characterPlay: { currentHitPoints: 1 },
      characterAction: (action) => action.label === 'Mend (1st level)'
    })
    expect(await readHitPoints(room)).toBe(1)

    const { answer } = await room.startAction(CHARACTER_ACTOR_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readHitPoints(room)).toBe(3)
    expect(await readSpellSlots(room)).toEqual(SLOT_SPENT)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await readHitPoints(room)).toBe(1)
    expect(await readSpellSlots(room)).toEqual([])
  })
})

describe('room Fireball cast by a Character wizard (SPELLS-8.4)', () => {
  // The fixture Character has Intelligence 12 and a +2 proficiency bonus: the wizard's spell save DC is 8 + 2 + 1.
  const WIZARD_SAVE_DC = 11

  /** The SRD Fireball, a Wolf out of its 20 ft reach, and `rolls` as the damage dice, then a 6 for any more. */
  const fireballRoom = (label: string, rolls: readonly number[]) =>
    actionRoom({
      actors: [
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        ...CAUGHT_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf })),
        srdCreatureActor({ id: OUT_OF_REACH_ID, creature: plainWolf })
      ],
      positions: { [OUT_OF_REACH_ID]: { x: 1500, y: 150 } },
      characterSpellcasting: { spells: [fireball], prepared: [fireball.id] },
      characterAction: (action) => action.label === label,
      rolls,
      fallbackRoll: 5
    })

  it.each([
    // A raw die is its face less one: 8d6 faces 2 3 4 5 6 1 2 3 and 9d6 faces 2 3 4 5 6 1 2 3 4.
    {
      label: 'Fireball (3rd level)',
      slotKey: 'STANDARD:3',
      rolls: [1, 2, 3, 4, 5, 0, 1, 2],
      damage: 26
    },
    {
      label: 'Fireball (4th level)',
      slotKey: 'STANDARD:4',
      rolls: [1, 2, 3, 4, 5, 0, 1, 2, 3],
      damage: 30
    }
  ])(
    'rolls the $label dice once for the whole area, saves against the wizard’s DC, and one undo restores the slot and every creature',
    async ({ label, slotKey, rolls, damage }) => {
      const room = await fireballRoom(label, rolls)
      const before = vitalsOf(await readRoomHistory(room.room.base.stub))
      const casterHitPoints = await readHitPoints(room)

      const { answer } = await room.startAreaAction({ x: 300, y: 150 })
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      const decision = await readPendingActionDecision(room.room.base.stub)
      if (decision?.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
      expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
        [CHARACTER_ACTOR_ID, ...CAUGHT_IDS].sort()
      )
      await answerAllSaves(room)

      const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
      expect(roots).toHaveLength(1)
      expect(roots[0]?.outputs.spellCastConsumption).toMatchObject({
        slotKey,
        beforeUsed: 0,
        afterUsed: 1
      })
      expect(children).toHaveLength(CAUGHT_IDS.length + 1)
      expect(children.map(({ outputs }) => outputs.d20?.defenseOrDc)).toEqual(
        children.map(() => WIZARD_SAVE_DC)
      )
      // Every caught creature takes the same roll; a roll per creature would take the 6s that follow the queue.
      const requested = children.flatMap(({ outputs }) =>
        outputs.applications.flatMap((application) =>
          application.kind === 'DAMAGE' ? [application.requestedAmount] : []
        )
      )
      expect(requested).toEqual(children.map(() => damage))
      expect(await readSpellSlots(room)).toEqual([{ slotKey, used: 1 }])
      expect(vitalsOf(await readRoomHistory(room.room.base.stub))).not.toEqual(before)
      expect(await readHitPoints(room)).toBeLessThan(casterHitPoints)

      await undoLastAction(room)
      expect(await readSpellSlots(room)).toEqual([])
      expect(vitalsOf(await readRoomHistory(room.room.base.stub))).toEqual(before)
      expect(await readHitPoints(room)).toBe(casterHitPoints)
    },
    120000
  )
})

describe('room Hold Person cast by a Character at a creature type it does not affect (SPELLS-8.5)', () => {
  const TARGET_ID = CAUGHT_IDS[0]!
  const TYPE_WARNING = 'TARGET_CREATURE_TYPE_EXCLUDED'
  // No Scene places the tokens, so the range is never measured.
  const RANGE_WARNING = 'TARGET_RANGE_UNCHECKED'
  const humanoidWolf = {
    ...plainWolf,
    creatureTypeId: SRD_CREATURE_TYPES.find(({ code }) => code === 'HUMANOID')!.id
  }

  const holdPersonRoom = (creature: typeof plainWolf) =>
    actionRoom({
      actors: [
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        srdCreatureActor({ id: TARGET_ID, creature })
      ],
      characterSpellcasting: { spells: [holdPerson], prepared: [holdPerson.id] },
      characterAction: (action) => action.label === 'Hold Person (2nd level)'
    })

  it('warns, overridably, for a Wolf and spends no slot until the warning is overridden', async () => {
    const room = await holdPersonRoom(plainWolf)

    const { answer } = await room.startAction(TARGET_ID, [RANGE_WARNING])
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'RULE_WARNINGS',
      warnings: [{ code: TYPE_WARNING }, { code: RANGE_WARNING }]
    })
    expect(await readSpellSlots(room)).toEqual([])

    const overridden = await room.startAction(TARGET_ID, [RANGE_WARNING, TYPE_WARNING])
    expect(overridden.answer.type, JSON.stringify(overridden.answer)).toBe('COMMAND_COMMITTED')
    expect((await room.pendingDecision()).pending.kind).toBe('D20_EVIDENCE')
  })

  it('raises no creature type warning for a Humanoid', async () => {
    const room = await holdPersonRoom(humanoidWolf)

    const { answer } = await room.startAction(TARGET_ID, [RANGE_WARNING])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await room.pendingDecision()).pending.kind).toBe('D20_EVIDENCE')
  })
})
