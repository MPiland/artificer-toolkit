import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { entangle } from '@artificer-toolkit/source-data/srd/spells/entangle.js'
import { grease } from '@artificer-toolkit/source-data/srd/spells/grease.js'
import { incendiaryCloud } from '@artificer-toolkit/source-data/srd/spells/incendiary-cloud.js'
import { insectPlague } from '@artificer-toolkit/source-data/srd/spells/insect-plague.js'
import { conditionTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { wallOfFire } from '@artificer-toolkit/source-data/srd/spells/wall-of-fire.js'
import { wallOfThorns } from '@artificer-toolkit/source-data/srd/spells/wall-of-thorns.js'
import { windWall } from '@artificer-toolkit/source-data/srd/spells/wind-wall.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  choiceOptionIdOf,
  endConcentrationAtSheet,
  hitPointsOf,
  readZones,
  revertLastAction
} from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T1g (D154 amendment): each creature in the area as a zone appears makes the spell's save
 * once, as the cast's own area save beside the zone it places, and takes the failed or the
 * successful outcome. A creature outside the area is unaffected.
 */

const CASTER_ACTOR_ID = testUuid(0x2640)
const CASTER_ID = testUuid(0x2641)
const WOLF_ID = testUuid(0x2642)

/** Every die the room rolls shows its lowest face: each save fails and each damage die is a 1. */
const DIE = 0
/** A first draw of 19 shows a 20 on the save, which succeeds. */
const SAVE_SUCCEEDS = [19]

/** 5 feet is 100 Scene units on the 1000-unit map; the caster's token stands at (150, 150). */
const ZONE_CENTER = { x: 600, y: 600 }
const OUTSIDE_THE_ZONE = { x: 950, y: 150 }
/** A 30-foot wall standing north to south through the zone's center. */
const WALL = { kind: 'WALL', from: { x: 600, y: 300 }, to: { x: 600, y: 900 } } as const

type Room = Awaited<ReturnType<typeof actionRoom>>
type Target = Parameters<Room['startAreaCommand']>[0]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function appearRoom(
  spell: SpellAuthored,
  castLabel: string,
  wolfAt: { x: number; y: number },
  rolls: readonly number[] = []
) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    positions: { [WOLF_ID]: wolfAt },
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label === castLabel,
    autoRoll: 'EVERYONE',
    rolls,
    fallbackRoll: DIE
  })
}

async function cast(room: Room, target: Target) {
  const { answer } = await room.startAreaCommand(target)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  expect(await readZones(room)).not.toEqual([])
}

async function conditionsOf(room: Room, actorId: string) {
  return vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === actorId)
    ?.conditions
}

const POINT = { kind: 'POINT', point: ZONE_CENTER } as const

/**
 * Each spell's damage as the zone appears, every die a 1: the full amount on a failed save and half
 * of it, rounded down, on a success.
 */
const DAMAGE_ZONES = [
  {
    spell: insectPlague,
    castLabel: 'Insect Plague (5th level)',
    target: POINT,
    failed: 4,
    succeeded: 2
  },
  {
    spell: incendiaryCloud,
    castLabel: 'Incendiary Cloud (8th level)',
    target: POINT,
    failed: 10,
    succeeded: 5
  },
  {
    spell: wallOfFire,
    castLabel: 'Wall of Fire (4th level)',
    target: {
      ...WALL,
      side: 'RIGHT',
      choiceOptionId: choiceOptionIdOf(wallOfFire, 'Straight Wall')
    },
    failed: 5,
    succeeded: 2
  },
  {
    spell: wallOfThorns,
    castLabel: 'Wall of Thorns (6th level)',
    target: { ...WALL, choiceOptionId: choiceOptionIdOf(wallOfThorns, 'Straight Wall') },
    failed: 7,
    succeeded: 3
  },
  {
    spell: windWall,
    castLabel: 'Wind Wall (3rd level)',
    target: WALL,
    failed: 3,
    succeeded: 1
  }
] as const satisfies readonly {
  spell: SpellAuthored
  castLabel: string
  target: Target
  failed: number
  succeeded: number
}[]

describe.each(DAMAGE_ZONES)(
  'the SRD $spell.label as it appears (SPELLS-4.T1g)',
  ({ spell, castLabel, target, failed, succeeded }) => {
    it.each([
      { outcome: 'the full damage on a failed save', rolls: [], damage: failed },
      { outcome: 'half the damage on a successful save', rolls: SAVE_SUCCEEDS, damage: succeeded }
    ])('deals a creature in the area $outcome', async ({ rolls, damage }) => {
      const room = await appearRoom(spell, castLabel, ZONE_CENTER, rolls)
      const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

      await cast(room, target)

      expect(await hitPointsOf(room, WOLF_ID)).toBe((hitPointsBefore ?? 0) - damage)
    })

    it('spares a creature outside the area', async () => {
      const room = await appearRoom(spell, castLabel, OUTSIDE_THE_ZONE)
      const hitPointsBefore = await hitPointsOf(room, WOLF_ID)

      await cast(room, target)

      expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore)
    })

    it('restores the creature and takes back the zone when the GM undoes the cast', async () => {
      const room = await appearRoom(spell, castLabel, ZONE_CENTER)
      const hitPointsBefore = await hitPointsOf(room, WOLF_ID)
      await cast(room, target)

      await revertLastAction(room)

      expect(await readZones(room)).toEqual([])
      expect(await hitPointsOf(room, WOLF_ID)).toBe(hitPointsBefore)
    })
  }
)

describe('the SRD Wind Wall zone (SPELLS-4.T1g)', () => {
  it('stands with no interaction once its appear save is made', async () => {
    const room = await appearRoom(windWall, 'Wind Wall (3rd level)', OUTSIDE_THE_ZONE)

    await cast(room, WALL)

    const [zone, ...others] = await readZones(room)
    expect(others).toEqual([])
    expect(zone?.placement.triggerModes).toEqual([])
    expect(zone?.placement.turnTriggers ?? []).toEqual([])
    expect(zone?.placement.heldCondition).toBeUndefined()
  })
})

const PRONE_ID = conditionTypeId('PRONE')
const RESTRAINED_ID = conditionTypeId('RESTRAINED')

describe('the SRD Grease as it appears (SPELLS-4.T1g)', () => {
  it.each([
    { outcome: 'knocks prone', rolls: [], conditions: [{ conditionTypeId: PRONE_ID }] },
    { outcome: 'spares', rolls: SAVE_SUCCEEDS, conditions: [] }
  ])('$outcome a creature in the area by its save', async ({ rolls, conditions }) => {
    const room = await appearRoom(grease, 'Grease (1st level)', ZONE_CENTER, rolls)

    await cast(room, POINT)

    expect(await conditionsOf(room, WOLF_ID)).toEqual(conditions)
  })

  it('spares a creature outside the area', async () => {
    const room = await appearRoom(grease, 'Grease (1st level)', OUTSIDE_THE_ZONE)

    await cast(room, POINT)

    expect(await conditionsOf(room, WOLF_ID)).toEqual([])
  })
})

/** The Wolf's effects, through which the zone holds its condition (D146), with their definitions. */
async function heldEffectsOf(room: Room) {
  return (await readRoomHistory(room.room.base.stub)).activeEffects
    .filter(({ targetActorId }) => targetActorId === WOLF_ID)
    .map(({ id, definitionJson }) => ({ id, definition: JSON.parse(definitionJson) }))
}

/**
 * Entangle's save as it appears is its only save: a creature that fails it is restrained, held by
 * the zone (SPELLS-4.T1e), and escapes with a Strength check at the caster's save DC.
 */
describe('the SRD Entangle as it appears (SPELLS-4.T1g)', () => {
  const room = (wolfAt: { x: number; y: number }, rolls?: readonly number[]) =>
    appearRoom(entangle, 'Entangle (1st level)', wolfAt, rolls)

  it('restrains a creature in the area that fails its save, held by the zone', async () => {
    const entangled = await room(ZONE_CENTER)

    await cast(entangled, POINT)

    const [zone] = await readZones(entangled)
    expect(zone?.placement.triggerModes).toEqual([])
    // Its area is difficult terrain (SPELLS-20 T4d).
    expect(zone?.placement.movementCostMultiplier).toBe(2)
    expect(await conditionsOf(entangled, WOLF_ID)).toEqual([{ conditionTypeId: RESTRAINED_ID }])
    const [held, ...others] = await heldEffectsOf(entangled)
    expect(others).toEqual([])
    expect(held?.definition).toMatchObject({
      stateContributions: [
        {
          kind: 'CONDITION_OWNERSHIP',
          conditionId: RESTRAINED_ID,
          baselinePresent: false,
          heldBySpatialEffectId: zone?.id
        },
        { kind: 'CONDITION_ESCAPE', label: entangle.label }
      ]
    })
  })

  it.each([
    {
      name: 'a creature in the area that makes its save',
      wolfAt: ZONE_CENTER,
      rolls: SAVE_SUCCEEDS
    },
    { name: 'a creature outside the area', wolfAt: OUTSIDE_THE_ZONE, rolls: [] }
  ])('spares $name', async ({ wolfAt, rolls }) => {
    const entangled = await room(wolfAt, rolls)

    await cast(entangled, POINT)

    expect(await conditionsOf(entangled, WOLF_ID)).toEqual([])
    expect(await heldEffectsOf(entangled)).toEqual([])
  })

  it('frees a creature whose Strength check reaches the caster’s save DC', async () => {
    // The save fails on a 1 and the escape check shows a 20.
    const entangled = await room(ZONE_CENTER, [0, 19])
    await cast(entangled, POINT)
    await entangled.advanceTurn()
    const [held] = await heldEffectsOf(entangled)
    if (!held) throw new Error('The zone holds no condition.')

    const answer = await entangled.send({
      type: 'ESCAPE',
      encounterId: entangled.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await entangled.version(),
      actorId: WOLF_ID,
      activeEffectId: held.id,
      checkDefinitionId: SRD_ABILITY_DEFINITION_IDS.STRENGTH,
      acknowledgedWarnings: []
    })

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectsOf(entangled)).toEqual([])
    expect(await conditionsOf(entangled, WOLF_ID)).toEqual([])
    expect(await readZones(entangled)).toHaveLength(1)
  })

  it('releases the creature when the caster’s Concentration ends', async () => {
    const entangled = await room(ZONE_CENTER)
    await cast(entangled, POINT)

    const answer = await endConcentrationAtSheet(entangled, CASTER_ID)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readZones(entangled)).toEqual([])
    expect(await heldEffectsOf(entangled)).toEqual([])
    expect(await conditionsOf(entangled, WOLF_ID)).toEqual([])
  })

  it('frees the creature and takes back the zone when the GM undoes the cast', async () => {
    const entangled = await room(ZONE_CENTER)
    await cast(entangled, POINT)

    await revertLastAction(entangled)

    expect(await readZones(entangled)).toEqual([])
    expect(await heldEffectsOf(entangled)).toEqual([])
    expect(await conditionsOf(entangled, WOLF_ID)).toEqual([])
  })
})
