import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ForcedMovementCollisionAuthored } from '@artificer-toolkit/shared/authored'
import { SQUARE_GRID_COMPASS_RAYS, type ScenePoint } from '@artificer-toolkit/shared/vtt'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_DAMAGE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { randomRay } from '../src/nativeEncounterActionInputs.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, directedAreaWolf, forceOnFailedSave } from './actionRoomFixture.js'
import { answerAllSaves, areaReceipts, tokenPositions, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-33.T6k2b3 (D159): a forced movement that carries an authored collision damages its mover
 * for every full 10 feet it travelled, as one more entry of the action's commit after the caught
 * creatures'; a random push's ray is rolled once and sealed with the pending area. A token is
 * 100 px, a cell 5 ft.
 */

const SOURCE_ID = testUuid(0xb40)
const NEAR_ID = testUuid(0xb41)
const FAR_ID = testUuid(0xb42)
const SOURCE_AT: ScenePoint = { x: 150, y: 150 }
const NEAR_AT: ScenePoint = { x: 250, y: 150 }
const FAR_AT: ScenePoint = { x: 350, y: 150 }
/** The compass ray each draw picks: N, NE, E, SE, S, SW, W, NW are 0 to 7. */
const EAST = 2
const WEST = 6

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const committed = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

const collision: ForcedMovementCollisionAuthored = {
  id: 'wind-collision',
  damageTypeId: SRD_DAMAGE_TYPES.find(({ code }) => code === 'BLUDGEONING')!.id,
  diceConfig: '1d6',
  savingThrow: {
    id: 'wind-collision-save',
    dcMethod: 'FIXED_DC',
    abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
    baseDc: 13
  },
  conditionId: srdSystemRecord.conditionTypes.find(({ code }) => code === 'PRONE')!.id
}

/**
 * A Wolf whose `reachFeet`-foot line pushes each creature that fails its save, `feet` away in
 * `direction` with the authored collision, and the creatures standing in `others`.
 */
async function lineRoom(input: {
  direction: Parameters<typeof forceOnFailedSave>[1]
  feet: number
  distanceMode?: 'EXACT' | 'UP_TO'
  reachFeet: number
  widthFeet?: number
  others: readonly { id: string; at: ScenePoint }[]
  rolls: number[]
}) {
  const creature = forceOnFailedSave(
    directedAreaWolf({
      shapeKind: 'LINE',
      length: { amount: input.reachFeet, unit: 'FEET' },
      width: { amount: input.widthFeet ?? 5, unit: 'FEET' }
    }),
    input.direction,
    input.feet,
    input.distanceMode,
    collision
  )
  const room = await actionRoom({
    rolls: input.rolls,
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      ...input.others.map(({ id }) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    positions: {
      [SOURCE_ID]: SOURCE_AT,
      ...Object.fromEntries(input.others.map(({ id, at }) => [id, at]))
    },
    ownerFeatureId: creature.features.find(({ label }) => label === 'Bite')?.id
  })
  committed((await room.startDirectedAreaAction({ x: 200, y: 150 }, { x: 500, y: 150 })).answer)
  await answerAllSaves(room)
  return room
}
type Room = Awaited<ReturnType<typeof lineRoom>>

const hitPointsOf = async (room: Room, actorId: string) =>
  vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === actorId)
    ?.currentHitPoints

const childTargets = async (room: Room) =>
  areaReceipts(await readRoomHistory(room.room.base.stub)).children.map(
    ({ outputs }) => outputs.targetActorId
  )

describe('a random push’s ray (SPELLS-33.T6k2b3)', () => {
  it('rolls the ray once when none is sealed', () => {
    const roll = vi.fn(() => EAST)
    expect(randomRay(NEAR_ID, undefined, roll)).toEqual(SQUARE_GRID_COMPASS_RAYS[EAST])
    expect(roll).toHaveBeenCalledExactlyOnceWith(SQUARE_GRID_COMPASS_RAYS.length)
  })

  it('keeps the ray sealed for its target when the area plans again, never rolling a second', () => {
    const sealed = SQUARE_GRID_COMPASS_RAYS[EAST]!
    const roll = vi.fn(() => WEST)
    expect(randomRay(NEAR_ID, [{ targetActorId: NEAR_ID, ray: sealed }], roll)).toEqual(sealed)
    expect(roll).not.toHaveBeenCalled()
  })

  it('rolls for a target that has no sealed ray', () => {
    const roll = vi.fn(() => WEST)
    const sealed = [{ targetActorId: FAR_ID, ray: SQUARE_GRID_COMPASS_RAYS[EAST]! }]
    expect(randomRay(NEAR_ID, sealed, roll)).toEqual(SQUARE_GRID_COMPASS_RAYS[WEST])
    expect(roll).toHaveBeenCalledTimes(1)
  })
})

describe('a forced movement’s collision damage to its mover (SPELLS-33.T6k2b3, D159)', () => {
  it('damages the mover for every full 10 feet it travelled, as one more entry after the caught creature’s, and gives it back on undo', async () => {
    // The mover's wolf has 11 hit points; 2d6 draws 3 and 4.
    const room = await lineRoom({
      direction: 'AWAY_FROM_SOURCE',
      feet: 20,
      reachFeet: 5,
      others: [{ id: NEAR_ID, at: NEAR_AT }],
      rolls: [2, 3]
    })

    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 650, y: 150 })
    expect(await hitPointsOf(room, NEAR_ID)).toBe(4)
    expect(await childTargets(room)).toEqual([NEAR_ID, NEAR_ID])

    committed(
      await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
    )
    expect(await hitPointsOf(room, NEAR_ID)).toBe(11)
    expect(tokenPositions(room)(NEAR_ID)).toEqual(NEAR_AT)
  })

  it('deals nothing for a move of under 10 feet', async () => {
    const room = await lineRoom({
      direction: 'AWAY_FROM_SOURCE',
      feet: 5,
      reachFeet: 5,
      others: [{ id: NEAR_ID, at: NEAR_AT }],
      rolls: [5, 5]
    })

    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 350, y: 150 })
    expect(await hitPointsOf(room, NEAR_ID)).toBe(11)
    expect(await childTargets(room)).toEqual([NEAR_ID])
  })

  it('damages several movers in the order they land, the farthest first', async () => {
    const room = await lineRoom({
      direction: 'AWAY_FROM_SOURCE',
      feet: 20,
      reachFeet: 15,
      others: [
        { id: NEAR_ID, at: NEAR_AT },
        { id: FAR_ID, at: FAR_AT }
      ],
      // FAR takes 1 + 1, NEAR 2 + 2.
      rolls: [0, 0, 1, 1]
    })

    expect(await childTargets(room)).toEqual([NEAR_ID, FAR_ID, FAR_ID, NEAR_ID])
    expect(await hitPointsOf(room, FAR_ID)).toBe(9)
    expect(await hitPointsOf(room, NEAR_ID)).toBe(7)
  })

  it.each([
    ['the lower ID first', NEAR_ID, FAR_ID],
    ['the lower ID last', FAR_ID, NEAR_ID]
  ])(
    'lands movers that are equally far from the source by actor ID, %s',
    async (_label, onAxis, off) => {
      const room = await lineRoom({
        direction: 'AWAY_FROM_SOURCE',
        feet: 20,
        reachFeet: 5,
        widthFeet: 40,
        others: [
          { id: onAxis, at: NEAR_AT },
          { id: off, at: { x: 250, y: 250 } }
        ],
        rolls: [0, 0, 1, 1]
      })

      expect((await childTargets(room)).slice(2)).toEqual([NEAR_ID, FAR_ID])
    }
  )
})
