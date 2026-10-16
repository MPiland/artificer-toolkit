import { runInDurableObject } from 'cloudflare:test'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { massCureWounds } from '@artificer-toolkit/source-data/srd/spells/mass-cure-wounds.js'
import { massHealingWord } from '@artificer-toolkit/source-data/srd/spells/mass-healing-word.js'
import { prayerOfHealing } from '@artificer-toolkit/source-data/srd/spells/prayer-of-healing.js'
import { SRD_CREATURE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const CHARACTER_ACTOR_ID = testUuid(0x7e0)
const CHARACTER_ID = testUuid(0x7e1)
const WOLF_IDS = [0x7e2, 0x7e3, 0x7e4, 0x7e5, 0x7e6, 0x7e7, 0x7e8].map(testUuid)
const FAR_WOLF_ID = testUuid(0x7e9)

const RANGE_UNCHECKED: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
const EXCLUDED_TYPE: EncounterRuleWarningCodeDto = 'TARGET_CREATURE_TYPE_EXCLUDED'

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const undead = SRD_CREATURE_TYPES.find((type) => type.code === 'UNDEAD')
if (!undead) throw new Error('The SRD names the undead creature type.')

/**
 * A Character who knows `spell` and a Wolf at 1 hit point for each of `wolfIds`, `rolls` as the dice
 * (a raw die is its face less one), then a 5 for any more.
 */
function healerRoom(config: {
  spell: SpellAuthored
  label: string
  rolls: readonly number[]
  wolfIds?: readonly string[]
  characterHitPoints?: number
}) {
  const wolfIds = config.wolfIds ?? WOLF_IDS.slice(0, 3)
  return actionRoom({
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      ...wolfIds.map((id) =>
        srdCreatureActor({
          id,
          creature: plainWolf,
          currentHitPoints: 1
        })
      ),
      srdCreatureActor({ id: FAR_WOLF_ID, creature: plainWolf, currentHitPoints: 1 })
    ],
    positions: { [FAR_WOLF_ID]: { x: 1500, y: 150 } },
    characterSpellcasting: { spells: [config.spell], prepared: [config.spell.id] },
    characterPlay: { currentHitPoints: config.characterHitPoints ?? 1 },
    characterAction: (action) => action.label === config.label,
    rolls: config.rolls,
    fallbackRoll: 5
  })
}

type HealerRoom = Awaited<ReturnType<typeof healerRoom>>

const readCharacterPlayState = (room: HealerRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row)
  })

const hitPointsOf = async (room: HealerRoom) =>
  Object.fromEntries(
    vitalsOf(await readRoomHistory(room.room.base.stub)).map((actor) => [
      actor.id,
      actor.currentHitPoints
    ])
  )

async function undoLastAction(room: HealerRoom) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

describe('room cast on chosen creatures (D118)', () => {
  it('heals every chosen creature from one roll in one commit, and one undo restores the slot and all of them', async () => {
    // 1d4 at the 3rd-level slot: the raw 2 is a 3, and the Character adds a +1 spellcasting modifier.
    const room = await healerRoom({
      spell: massHealingWord,
      label: 'Mass Healing Word (3rd level)',
      rolls: [2]
    })
    const chosen = WOLF_IDS.slice(0, 3)
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction(chosen, RANGE_UNCHECKED, false)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    // Every creature gains the same 4: a roll per creature would give the later ones the fallback 5s.
    expect(await hitPointsOf(room)).toEqual({
      ...before,
      ...Object.fromEntries(chosen.map((id) => [id, 5]))
    })
    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(roots[0]?.outputs.spellCastConsumption).toMatchObject({
      slotKey: 'STANDARD:3',
      beforeUsed: 0,
      afterUsed: 1
    })
    expect(children.map(({ outputs }) => outputs.targetActorId)).toEqual(chosen)
    expect((await readCharacterPlayState(room)).spellSlots).toEqual([
      { slotKey: 'STANDARD:3', used: 1 }
    ])

    await undoLastAction(room)
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('rolls the scaled dice once when cast with a higher slot', async () => {
    // 2d4 at the 4th-level slot: raw 1 and 2 are a 2 and a 3, plus the +1 modifier.
    const room = await healerRoom({
      spell: massHealingWord,
      label: 'Mass Healing Word (4th level)',
      rolls: [1, 2]
    })
    const chosen = WOLF_IDS.slice(0, 3)

    const { answer } = await room.startActorsAction(chosen, RANGE_UNCHECKED, false)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await hitPointsOf(room)).toMatchObject(
      Object.fromEntries(chosen.map((id) => [id, 1 + 2 + 3 + 1]))
    )
    expect((await readCharacterPlayState(room)).spellSlots).toEqual([
      { slotKey: 'STANDARD:4', used: 1 }
    ])
  }, 120000)

  it('heals the caster among the chosen creatures with the one slot spent once', async () => {
    const room = await healerRoom({
      spell: massHealingWord,
      label: 'Mass Healing Word (3rd level)',
      rolls: [2]
    })
    const chosen = [CHARACTER_ACTOR_ID, WOLF_IDS[0]!]

    const { answer } = await room.startActorsAction(chosen, RANGE_UNCHECKED, false)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const play = await readCharacterPlayState(room)
    expect(play.hitpoints.current).toBe(1 + 3 + 1)
    expect(play.spellSlots).toEqual([{ slotKey: 'STANDARD:3', used: 1 }])
    expect((await hitPointsOf(room))[WOLF_IDS[0]!]).toBe(5)

    await undoLastAction(room)
    expect((await readCharacterPlayState(room)).hitpoints.current).toBe(1)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('heals with Prayer of Healing from its own 2d8 and its own cap of six', async () => {
    // 2d8 at the 2nd-level slot: raw 0 and 2 are a 1 and a 3, plus the +1 modifier.
    const room = await healerRoom({
      spell: prayerOfHealing,
      label: 'Prayer of Healing (2nd level)',
      rolls: [0, 2],
      wolfIds: WOLF_IDS.slice(0, 6)
    })
    const chosen = WOLF_IDS.slice(0, 6)

    const { answer } = await room.startActorsAction(chosen, RANGE_UNCHECKED, false)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await hitPointsOf(room)).toMatchObject(
      Object.fromEntries(chosen.map((id) => [id, 1 + 1 + 3 + 1]))
    )
  }, 120000)

  it.each([
    { spell: massHealingWord, label: 'Mass Healing Word (3rd level)' },
    { spell: massCureWounds, label: 'Mass Cure Wounds (5th level)' }
  ])(
    'refuses $label aimed at one creature, as it takes a list',
    async ({ spell, label }) => {
      const room = await healerRoom({ spell, label, rolls: [2] })
      const before = await hitPointsOf(room)

      const { answer } = await room.startAction(WOLF_IDS[0]!)
      expect(answer.type).not.toBe('COMMAND_COMMITTED')
      expect(JSON.stringify(answer)).toContain('does not permit this target')
      expect(await hitPointsOf(room)).toEqual(before)
      expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
    },
    120000
  )

  it('refuses more creatures than the spell names, and spends nothing', async () => {
    const room = await healerRoom({
      spell: massHealingWord,
      label: 'Mass Healing Word (3rd level)',
      rolls: [2],
      wolfIds: WOLF_IDS
    })
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction(WOLF_IDS, RANGE_UNCHECKED, false)
    expect(answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(answer)).toContain('at most 6')
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('warns once per excluded creature type, overridably, and heals everyone once overridden', async () => {
    const chosen = WOLF_IDS.slice(0, 3)
    const room = await actionRoom({
      actors: [
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        srdCreatureActor({
          id: chosen[0]!,
          creature: { ...plainWolf, creatureTypeId: undead.id },
          currentHitPoints: 1
        }),
        ...chosen
          .slice(1)
          .map((id) => srdCreatureActor({ id, creature: plainWolf, currentHitPoints: 1 }))
      ],
      characterSpellcasting: { spells: [massHealingWord], prepared: [massHealingWord.id] },
      characterAction: (action) => action.label === 'Mass Healing Word (3rd level)',
      rolls: [2],
      fallbackRoll: 5
    })

    const refused = await room.startActorsAction(chosen, RANGE_UNCHECKED, false)
    expect(refused.answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(refused.answer)).toContain(EXCLUDED_TYPE)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])

    const { answer } = await room.startActorsAction(
      chosen,
      [...RANGE_UNCHECKED, EXCLUDED_TYPE],
      false
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await hitPointsOf(room)).toMatchObject(Object.fromEntries(chosen.map((id) => [id, 5])))
  }, 120000)

  it('warns when a chosen creature is beyond the spell’s range on the Scene', async () => {
    const room = await healerRoom({
      spell: massHealingWord,
      label: 'Mass Healing Word (3rd level)',
      rolls: [2]
    })
    const chosen = [WOLF_IDS[0]!, FAR_WOLF_ID]

    const refused = await room.startActorsAction(chosen)
    expect(refused.answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(refused.answer)).toContain('TARGET_OUT_OF_RANGE')
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])

    const { answer } = await room.startActorsAction(chosen, ['TARGET_OUT_OF_RANGE'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  }, 120000)
})

describe('room cast on chosen creatures inside an area (Mass Cure Wounds, D118)', () => {
  const mcw = (rolls: readonly number[], wolfIds: readonly string[] = WOLF_IDS) =>
    healerRoom({ spell: massCureWounds, label: 'Mass Cure Wounds (5th level)', rolls, wolfIds })
  // Wolves stand one square apart from the caster at x = 250; the point is on the second wolf.
  const POINT = { x: 350, y: 150 }

  it('heals the chosen creatures inside the sphere from one roll in one commit', async () => {
    // 3d8 at the 5th-level slot: raw 0, 1 and 2 are a 1, a 2 and a 3, plus the +1 modifier.
    const room = await mcw([0, 1, 2], WOLF_IDS.slice(0, 3))
    const chosen = WOLF_IDS.slice(0, 3)
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction(chosen, RANGE_UNCHECKED, true, POINT)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await hitPointsOf(room)).toEqual({
      ...before,
      ...Object.fromEntries(chosen.map((id) => [id, 1 + 1 + 2 + 3 + 1]))
    })
    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(children).toHaveLength(3)
    expect((await readCharacterPlayState(room)).spellSlots).toEqual([
      { slotKey: 'STANDARD:5', used: 1 }
    ])

    await undoLastAction(room)
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('refuses a chosen creature outside the sphere, and spends nothing', async () => {
    const room = await mcw([0, 1, 2])
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction(
      [WOLF_IDS[0]!, FAR_WOLF_ID],
      RANGE_UNCHECKED,
      true,
      POINT
    )
    expect(answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(answer)).toContain('not inside the area')
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('needs a point to aim at', async () => {
    const room = await mcw([0, 1, 2])

    const { answer } = await room.startActorsAction([WOLF_IDS[0]!], RANGE_UNCHECKED, true)
    expect(answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(answer)).toContain('needs a point')
  }, 120000)

  it('warns once for a point beyond the spell’s range, and heals once overridden', async () => {
    const room = await mcw([0, 1, 2])
    const chosen = [FAR_WOLF_ID]
    const farPoint = { x: 1500, y: 150 }

    const refused = await room.startActorsAction(chosen, RANGE_UNCHECKED, true, farPoint)
    expect(refused.answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(refused.answer)).toContain('TARGET_OUT_OF_RANGE')
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])

    const { answer } = await room.startActorsAction(chosen, ['TARGET_OUT_OF_RANGE'], true, farPoint)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await hitPointsOf(room))[FAR_WOLF_ID]).toBe(1 + 1 + 2 + 3 + 1)
  }, 120000)
})
