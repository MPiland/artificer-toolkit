import { runInDurableObject } from 'cloudflare:test'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import {
  type EncounterAreaActionPendingContextDto,
  serverAggregateChoicePendingSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { acidSplash } from '@artificer-toolkit/source-data/srd/spells/acid-splash.js'
import { chainLightning } from '@artificer-toolkit/source-data/srd/spells/chain-lightning.js'
import { schoolOfEvocation } from '@artificer-toolkit/source-data/srd/classes/school-of-evocation.js'
import { eldritchBlast } from '@artificer-toolkit/source-data/srd/spells/eldritch-blast.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { massCureWounds } from '@artificer-toolkit/source-data/srd/spells/mass-cure-wounds.js'
import { massHealingWord } from '@artificer-toolkit/source-data/srd/spells/mass-healing-word.js'
import { prayerOfHealing } from '@artificer-toolkit/source-data/srd/spells/prayer-of-healing.js'
import { scorchingRay as scorchingRaySpell } from '@artificer-toolkit/source-data/srd/spells/scorching-ray.js'
import {
  SRD_CREATURE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory, readRoomRollCards } from './roomHistoryReads.js'

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
const invisible = srdSystemRecord.conditionTypes.find(({ code }) => code === 'INVISIBLE')
if (!invisible) throw new Error('The SRD names the Invisible condition.')

/**
 * A Character who knows `spell` and a Wolf at 1 hit point for each of `wolfIds`, `rolls` as the dice
 * (a raw die is its face less one), then a 5 for any more.
 */
function healerRoom(config: {
  spell: SpellAuthored
  label: string
  rolls: readonly number[]
  wolfIds?: readonly string[]
  wolfHitPoints?: number
  characterHitPoints?: number
  /** The Character's level; it is 1 when unset. */
  characterLevel?: number
  /** Sheet conditions the Character already carries. */
  characterConditions?: { conditionTypeId: string; label: string }[]
  autoRoll?: 'BOTH'
  characterClassFeatures?: Parameters<typeof actionRoom>[0]['characterClassFeatures']
  seed?: Parameters<typeof actionRoom>[0]['seed']
}) {
  const wolfIds = config.wolfIds ?? WOLF_IDS.slice(0, 3)
  return actionRoom({
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      ...wolfIds.map((id) =>
        srdCreatureActor({
          id,
          // A Wolf given hit points has them as its maximum too, else it is at 1.
          creature:
            config.wolfHitPoints === undefined
              ? plainWolf
              : { ...plainWolf, hitPoints: config.wolfHitPoints },
          currentHitPoints: config.wolfHitPoints ?? 1
        })
      ),
      srdCreatureActor({ id: FAR_WOLF_ID, creature: plainWolf, currentHitPoints: 1 })
    ],
    positions: { [FAR_WOLF_ID]: { x: 1500, y: 150 } },
    characterSpellcasting: { spells: [config.spell], prepared: [config.spell.id] },
    characterPlay: {
      currentHitPoints: config.characterHitPoints ?? 1,
      ...(config.characterLevel && { classLevel: config.characterLevel }),
      ...(config.characterConditions && { conditions: config.characterConditions })
    },
    characterAction: (action) => action.label === config.label,
    rolls: config.rolls,
    fallbackRoll: 5,
    ...(config.autoRoll && { autoRoll: config.autoRoll }),
    ...(config.characterClassFeatures && { characterClassFeatures: config.characterClassFeatures }),
    ...(config.seed && { seed: config.seed })
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

  it('ends the caster’s grant that ends on a spell cast, releases the condition it owned, and one undo gives both back (SPELLS-27.1)', async () => {
    const castEnds = await healerRoom({
      spell: massHealingWord,
      label: 'Mass Healing Word (3rd level)',
      rolls: [2],
      characterConditions: [{ conditionTypeId: invisible.id, label: 'Invisible' }],
      seed: seedModifierGrant({
        sourceActorId: CHARACTER_ACTOR_ID,
        holderActorId: CHARACTER_ACTOR_ID,
        lifecycle: {},
        endsOnCast: true,
        ownedConditionId: invisible.id
      })
    })
    const grantIds = async () =>
      (await readRoomHistory(castEnds.room.base.stub)).characterEffects.map(({ id }) => id)
    const conditionIds = async () =>
      ((await readCharacterPlayState(castEnds)).conditions ?? []).map(
        ({ conditionTypeId }) => conditionTypeId
      )
    const held = await grantIds()
    expect(held).toHaveLength(1)
    expect(await conditionIds()).toEqual([invisible.id])

    const { answer } = await castEnds.startActorsAction(
      WOLF_IDS.slice(0, 3),
      RANGE_UNCHECKED,
      false
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await grantIds()).toEqual([])
    expect(await conditionIds()).toEqual([])

    await undoLastAction(castEnds)
    expect(await grantIds()).toEqual(held)
    expect(await conditionIds()).toEqual([invisible.id])
  }, 120000)

  it('ends the grant and releases its condition when the caster is among the chosen creatures', async () => {
    const castEnds = await healerRoom({
      spell: massHealingWord,
      label: 'Mass Healing Word (3rd level)',
      rolls: [2],
      characterConditions: [{ conditionTypeId: invisible.id, label: 'Invisible' }],
      seed: seedModifierGrant({
        sourceActorId: CHARACTER_ACTOR_ID,
        holderActorId: CHARACTER_ACTOR_ID,
        lifecycle: {},
        endsOnCast: true,
        ownedConditionId: invisible.id
      })
    })
    const grantIds = async () =>
      (await readRoomHistory(castEnds.room.base.stub)).characterEffects.map(({ id }) => id)
    const conditionIds = async () =>
      ((await readCharacterPlayState(castEnds)).conditions ?? []).map(
        ({ conditionTypeId }) => conditionTypeId
      )
    const held = await grantIds()

    const { answer } = await castEnds.startActorsAction(
      [CHARACTER_ACTOR_ID, WOLF_IDS[0]!],
      RANGE_UNCHECKED,
      false
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await grantIds()).toEqual([])
    expect(await conditionIds()).toEqual([])

    await undoLastAction(castEnds)
    expect(await grantIds()).toEqual(held)
    expect(await conditionIds()).toEqual([invisible.id])
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

describe('room cast of projectiles on chosen creatures (Magic Missile, SPELLS-26)', () => {
  // Each Wolf has 11 hit points. Magic Missile's dart is 1d4+1, and a raw die is its face less one.
  const missiles = (level: 1 | 2, rolls: readonly number[]) =>
    healerRoom({
      spell: magicMissile,
      label: `Magic Missile (${level === 1 ? '1st' : '2nd'} level)`,
      rolls,
      wolfHitPoints: 11,
      characterHitPoints: 5
    })
  const [first, second] = WOLF_IDS as [string, string]
  const requestedDamage = (children: ReturnType<typeof areaReceipts>['children']) =>
    children.flatMap(({ outputs }) =>
      outputs.applications.flatMap((application) =>
        'requestedAmount' in application ? [application.requestedAmount] : []
      )
    )

  it('rolls each dart on its own, lands them in order, and spends the slot once', async () => {
    const room = await missiles(1, [0, 3, 1])
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction([first, first, second], RANGE_UNCHECKED, false)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    // Darts of 2, 5 and 3: the first creature takes the first two off its 11, the second the third.
    expect(await hitPointsOf(room)).toEqual({ ...before, [first]: 11 - 2 - 5, [second]: 11 - 3 })
    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(roots[0]?.outputs.targetOccurrenceIds).toHaveLength(3)
    expect(children.map(({ outputs }) => outputs.targetActorId)).toEqual([first, first, second])
    expect(requestedDamage(children)).toEqual([2, 5, 3])
    expect(await readRoomRollCards(room.room.base.stub)).toHaveLength(3)
    expect((await readCharacterPlayState(room)).spellSlots).toEqual([
      { slotKey: 'STANDARD:1', used: 1 }
    ])

    await undoLastAction(room)
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('fires a further dart for each level of a higher slot', async () => {
    const room = await missiles(2, [0, 0, 0, 0])

    const { answer } = await room.startActorsAction(
      [first, second, first, second],
      RANGE_UNCHECKED,
      false
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await hitPointsOf(room)).toMatchObject({ [first]: 11 - 4, [second]: 11 - 4 })
    expect((await readCharacterPlayState(room)).spellSlots).toEqual([
      { slotKey: 'STANDARD:2', used: 1 }
    ])
  }, 120000)

  it('hits the caster with their own darts, the slot spent with the first of them', async () => {
    const room = await missiles(1, [0, 0, 0])

    const { answer } = await room.startActorsAction(
      [CHARACTER_ACTOR_ID, CHARACTER_ACTOR_ID, first],
      RANGE_UNCHECKED,
      false
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const play = await readCharacterPlayState(room)
    expect(play.hitpoints.current).toBe(5 - 2 - 2)
    expect(play.spellSlots).toEqual([{ slotKey: 'STANDARD:1', used: 1 }])
    expect((await hitPointsOf(room))[first]).toBe(11 - 2)

    await undoLastAction(room)
    expect((await readCharacterPlayState(room)).hitpoints.current).toBe(5)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('refuses more darts than the slot gives, and spends nothing', async () => {
    const room = await missiles(1, [0, 0, 0, 0])
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction(
      [first, first, second, second],
      RANGE_UNCHECKED,
      false
    )
    expect(answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(answer)).toContain('at most 3')
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('refuses a creature named twice by a spell that heals each creature once', async () => {
    const room = await healerRoom({
      spell: massHealingWord,
      label: 'Mass Healing Word (3rd level)',
      rolls: [2]
    })
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction([first, first], RANGE_UNCHECKED, false)
    expect(answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(answer)).toContain('names each creature once')
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)
})

describe('room cast on chosen creatures that each save (Acid Splash, Chain Lightning, SPELLS-26)', () => {
  const [first, second, third] = WOLF_IDS as [string, string, string]
  const FAIL = 1
  const SAVE = 20
  const pendingSaves = async (room: HealerRoom) => {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    return { decision, saves: decision.pending.saves }
  }
  /** `actorId`'s own save answered with one natural d20 face; the answer must commit. */
  async function answerSave(room: HealerRoom, actorId: string, face: number) {
    const { decision, saves } = await pendingSaves(room)
    const save = saves.find((entry) => entry.actorId === actorId)
    if (!save) throw new Error('The creature has no pending save.')
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
  const splash = (config: { rolls?: readonly number[]; autoRoll?: 'BOTH' } = {}) =>
    healerRoom({
      spell: acidSplash,
      label: 'Acid Splash',
      rolls: config.rolls ?? [],
      autoRoll: config.autoRoll,
      wolfHitPoints: 20
    })
  const lightning = () =>
    healerRoom({
      spell: chainLightning,
      label: 'Chain Lightning (6th level)',
      rolls: [],
      wolfHitPoints: 100
    })

  it('waits for each creature’s own save, then burns only those that fail, from one roll', async () => {
    // The 1d6 acid: the raw 2 is a 3, rolled once for the whole cast.
    const room = await splash({ rolls: [2] })
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction([first, second], [], true)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const { saves } = await pendingSaves(room)
    expect(saves.map((save) => save.actorId).sort()).toEqual([first, second].sort())
    expect(await hitPointsOf(room)).toEqual(before)

    await answerSave(room, first, FAIL)
    expect(await hitPointsOf(room)).toEqual(before)
    await answerSave(room, second, SAVE)

    expect(await hitPointsOf(room)).toEqual({ ...before, [first]: 20 - 3 })
    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(children.map(({ outputs }) => outputs.targetActorId).sort()).toEqual(
      [first, second].sort()
    )

    await undoLastAction(room)
    expect(await hitPointsOf(room)).toEqual(before)
  }, 120000)

  it('waits for the saves and burns the creatures that fail, though the Scene was not read', async () => {
    const room = await splash({ rolls: [2] })
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction([first, second], RANGE_UNCHECKED, false)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await pendingSaves(room)).saves).toHaveLength(2)

    await answerSave(room, first, SAVE)
    await answerSave(room, second, FAIL)
    expect(await hitPointsOf(room)).toEqual({ ...before, [second]: 20 - 3 })
  }, 120000)

  it('settles at once when every roller rolls for itself', async () => {
    // The saves roll first (a raw 0 is a 1, a raw 19 is a 20), then the 1d6 acid: the raw 4 is a 5.
    const room = await splash({ rolls: [0, 19, 4], autoRoll: 'BOTH' })
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction([first, second], [], true)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await hitPointsOf(room)).toEqual({ ...before, [first]: 20 - 5 })
    expect(areaReceipts(await readRoomHistory(room.room.base.stub)).roots).toHaveLength(1)
  }, 120000)

  it('settles the creatures left when the GM takes one out, which is not tested or burned', async () => {
    const room = await splash({ rolls: [2] })
    const before = await hitPointsOf(room)
    expect((await room.startActorsAction([first, second], [], true)).answer.type).toBe(
      'COMMAND_COMMITTED'
    )
    await answerSave(room, first, FAIL)

    const removal = await room.send(
      room.removeAreaTargetCommand(await room.pendingDecision(), second)
    )
    expect(removal.type, JSON.stringify(removal)).toBe('COMMAND_COMMITTED')

    expect(await hitPointsOf(room)).toEqual({ ...before, [first]: 20 - 3 })
  }, 120000)

  it('burns the creatures that fail with the full dice and the ones that save with the lesser, spending one slot', async () => {
    // Every die is a 6 (the fallback): the failing creature takes the 10d8, the saving one half of it.
    const room = await lightning()
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction([first, second, third], [], true)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])

    await answerSave(room, first, FAIL)
    await answerSave(room, second, SAVE)
    await answerSave(room, third, FAIL)

    expect(await hitPointsOf(room)).toEqual({
      ...before,
      [first]: 100 - 60,
      [second]: 100 - 30,
      [third]: 100 - 60
    })
    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(children).toHaveLength(3)
    expect((await readCharacterPlayState(room)).spellSlots).toEqual([
      { slotKey: 'STANDARD:6', used: 1 }
    ])

    await undoLastAction(room)
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('refuses more creatures than the cast level allows, and spends nothing', async () => {
    const room = await healerRoom({
      spell: chainLightning,
      label: 'Chain Lightning (6th level)',
      rolls: [],
      wolfIds: WOLF_IDS.slice(0, 5)
    })
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction(WOLF_IDS.slice(0, 5), [], true)
    expect(answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(answer)).toContain('at most 4')
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)
})

describe('room cast of rays on chosen creatures (Scorching Ray, Eldritch Blast, SPELLS-26)', () => {
  const [first, second, third] = WOLF_IDS as [string, string, string]
  const HIT = 19
  const CRIT = 20
  const MISS = 1
  const pendingRays = async (room: HealerRoom) => {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the pending rays.')
    return { decision, rays: decision.pending.saves }
  }
  /** The next unanswered ray aimed at `targetActorId`, answered with one natural d20 face. */
  async function answerRay(room: HealerRoom, targetActorId: string, face: number) {
    const { decision, rays } = await pendingRays(room)
    const ray = rays.find((entry) => entry.targetActorId === targetActorId)
    if (!ray) throw new Error('No ray is awaiting an attack roll at the creature.')
    expect(ray.actorId).toBe(CHARACTER_ACTOR_ID)
    const answer = await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: ray.request.requestId,
        rawFaces: [face],
        rollMode: ray.request.rollMode
      })
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  }
  const requestedDamage = (children: ReturnType<typeof areaReceipts>['children']) =>
    children
      .flatMap(({ outputs }) =>
        outputs.applications.flatMap((application) =>
          'requestedAmount' in application ? [application.requestedAmount] : []
        )
      )
      .sort((left, right) => left - right)
  const scorchingRay = (config: { rolls: readonly number[]; autoRoll?: 'BOTH' }) =>
    healerRoom({
      spell: scorchingRaySpell,
      label: 'Scorching Ray (2nd level)',
      rolls: config.rolls,
      autoRoll: config.autoRoll,
      wolfHitPoints: 40
    })
  const blast = (characterLevel: number, rolls: readonly number[]) =>
    healerRoom({
      spell: eldritchBlast,
      label: 'Eldritch Blast',
      rolls,
      characterLevel,
      wolfHitPoints: 20
    })

  it('waits for an attack roll for each ray, rolls each hit on its own, and spends the slot once', async () => {
    // The first ray's 2d6 are the raw 0 and 1 (a 1 and a 2); the critical ray rolls every die as a 6.
    const room = await scorchingRay({ rolls: [0, 1] })
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction([first, first, second], [], true)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const { rays } = await pendingRays(room)
    expect(rays.map((ray) => ray.targetActorId)).toEqual([first, first, second])
    expect(await hitPointsOf(room)).toEqual(before)
    // The slot is spent when the cast commits, with the last ray.
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])

    await answerRay(room, first, HIT)
    await answerRay(room, first, CRIT)
    expect(await hitPointsOf(room)).toEqual(before)
    await answerRay(room, second, MISS)

    // The second ray meets the hit points the first left: 40 - 3 - 24.
    expect(await hitPointsOf(room)).toEqual({ ...before, [first]: 13 })
    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(children).toHaveLength(3)
    expect(requestedDamage(children)).toEqual([3, 24])
    expect((await readCharacterPlayState(room)).spellSlots).toEqual([
      { slotKey: 'STANDARD:2', used: 1 }
    ])

    await undoLastAction(room)
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('keeps the pending context honest: only the caster repeats a creature, and no roll repeats', async () => {
    const room = await scorchingRay({ rolls: [] })
    await room.startActorsAction([first, first, second], [], true)

    const verdicts = await runInDurableObject(room.room.base.stub, async (_instance, context) => {
      const store = new RoomEncounterStore(context.storage)
      const occurrence = store
        .documents('encounterRuleOccurrences')
        .find((candidate) => candidate.state === 'PENDING')
      if (!occurrence) throw new Error('No area action is pending.')
      const snapshot = await readPendingSnapshot({ db: store.store }, occurrence)
      if (snapshot?.applicationContext.kind !== 'ENCOUNTER_AREA_ACTION')
        throw new Error('Expected the pending area action.')
      const accepts = (
        mutate: (targets: EncounterAreaActionPendingContextDto['targets']) => void
      ) => {
        const copy = structuredClone(snapshot)
        if (copy.applicationContext.kind !== 'ENCOUNTER_AREA_ACTION')
          throw new Error('Expected the pending area action.')
        mutate(copy.applicationContext.targets)
        return serverAggregateChoicePendingSnapshotDtoSchema.safeParse(copy).success
      }
      return {
        intact: accepts(() => {}),
        creatureRollsRepeat: accepts((targets) => {
          for (const target of targets)
            if (target.snapshot.applicationContext.kind === 'ENCOUNTER_ACTION')
              target.snapshot.applicationContext.rollerActorId = target.actorId
        }),
        occurrenceRepeats: accepts((targets) => {
          targets[1]!.snapshot.occurrenceId = targets[0]!.snapshot.occurrenceId
        })
      }
    })

    expect(verdicts).toEqual({ intact: true, creatureRollsRepeat: false, occurrenceRepeats: false })
  }, 120000)

  it('settles at once when the caster rolls for themself', async () => {
    // The three attack rolls first (a hit, a critical hit, a miss), then the first ray's 2d6 (a 1 and a
    // 2) and the critical ray's 4d6, each a 6.
    const room = await scorchingRay({ rolls: [18, 19, 0, 0, 1], autoRoll: 'BOTH' })
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction([first, second, third], [], true)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await hitPointsOf(room)).toEqual({ ...before, [first]: 40 - 3, [second]: 40 - 24 })
    expect(areaReceipts(await readRoomHistory(room.room.base.stub)).roots).toHaveLength(1)
  }, 120000)

  it('refuses more rays than the slot gives, and spends nothing', async () => {
    const room = await scorchingRay({ rolls: [] })
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction([first, first, second, third], [], true)
    expect(answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(answer)).toContain('at most 3')
    expect(await hitPointsOf(room)).toEqual(before)
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it('lets the GM take a creature out with every ray aimed at it', async () => {
    const room = await scorchingRay({ rolls: [0, 1] })
    const before = await hitPointsOf(room)
    expect((await room.startActorsAction([first, second, second], [], true)).answer.type).toBe(
      'COMMAND_COMMITTED'
    )
    await answerRay(room, first, HIT)

    const removal = await room.send(
      room.removeAreaTargetCommand(await room.pendingDecision(), second)
    )
    expect(removal.type, JSON.stringify(removal)).toBe('COMMAND_COMMITTED')

    expect(await hitPointsOf(room)).toEqual({ ...before, [first]: 40 - 3 })
  }, 120000)

  it('fires a second beam from the 5th level, which meets the hit points the first left', async () => {
    // The beams are a raw 8 and a raw 6 on a d10: a 9 and a 7, on a Wolf of 20 hit points.
    const room = await blast(5, [8, 6])
    const before = await hitPointsOf(room)

    const { answer } = await room.startActorsAction([first, first], [], true)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerRay(room, first, HIT)
    await answerRay(room, first, HIT)

    expect(await hitPointsOf(room)).toEqual({ ...before, [first]: 20 - 9 - 7 })
    expect(
      requestedDamage(areaReceipts(await readRoomHistory(room.room.base.stub)).children)
    ).toEqual([7, 9])
    // A cantrip spends no slot.
    expect((await readCharacterPlayState(room)).spellSlots ?? []).toEqual([])
  }, 120000)

  it.each([
    [1, 1, 2],
    [5, 2, 3]
  ])(
    'refuses more beams than the Character level gives (level %i, %i beams)',
    async (level, beams, named) => {
      const room = await blast(level, [])
      const before = await hitPointsOf(room)

      const { answer } = await room.startActorsAction(WOLF_IDS.slice(0, named), [], true)
      expect(answer.type).not.toBe('COMMAND_COMMITTED')
      expect(JSON.stringify(answer)).toContain('at most ' + beams)
      expect(await hitPointsOf(room)).toEqual(before)
    },
    120000
  )
})

describe('room cast of a cantrip by a Character with Potent Cantrip (SPELLS-31.T5i4)', () => {
  const [wolf] = WOLF_IDS as [string]
  const potentCantrip = () => {
    const feature = schoolOfEvocation.features?.find(({ label }) => label === 'Potent Cantrip')
    if (!feature?.grants) throw new Error('The SRD School of Evocation must author Potent Cantrip.')
    return { ...feature, availableAtLevel: 1, order: 0 }
  }
  const splash = (withFeature: boolean) =>
    healerRoom({
      spell: acidSplash,
      label: 'Acid Splash',
      // The 2d6 acid: the raw 2 and 3 are a 3 and a 4, rolled once for the cast.
      rolls: [2, 3],
      wolfIds: [wolf],
      wolfHitPoints: 20,
      characterLevel: 5,
      characterClassFeatures: withFeature ? [potentCantrip()] : []
    })
  async function saveAgainstSplash(room: HealerRoom, face: number) {
    const { answer } = await room.startActorsAction([wolf], [], true)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const [save] = decision.pending.saves
    if (!save) throw new Error('The creature has no pending save.')
    const resolved = await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [face],
        rollMode: save.request.rollMode
      })
    )
    expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')
  }

  it('burns a creature that saves for half the acid, where it would take none', async () => {
    const room = await splash(true)
    await saveAgainstSplash(room, 20)
    expect(await hitPointsOf(room)).toMatchObject({ [wolf]: 20 - 3 })
  }, 120000)

  it('burns a creature that fails for the full acid', async () => {
    const room = await splash(true)
    await saveAgainstSplash(room, 1)
    expect(await hitPointsOf(room)).toMatchObject({ [wolf]: 20 - 7 })
  }, 120000)

  it('leaves a creature that saves unburned without the feature', async () => {
    const room = await splash(false)
    await saveAgainstSplash(room, 20)
    expect(await hitPointsOf(room)).toMatchObject({ [wolf]: 20 })
  }, 120000)
})
