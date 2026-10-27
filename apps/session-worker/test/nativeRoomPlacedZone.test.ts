import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf, readZones, revertLastAction, walkerMoves } from './placedZoneRoomReads.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-17: the real SRD Caltrops, spread by a Character at a point, becomes one fixed zone that
 * the next creature to enter rolls its authored save against.
 */

const SPREADER_ACTOR_ID = testUuid(0x1700)
const SPREADER_ID = testUuid(0x1701)
const WALKER_ID = testUuid(0x1702)

/** The 5 ft square the Caltrops cover: centred one cell from the spreader, who stands at x = 150. */
const FIELD_POINT = { x: 250, y: 150 }
const WALKER_START = { x: 450, y: 150 }
/**
 * Into the field and to its middle: 10 ft, inside the Wolf's 40 ft even once slowed. The Caltrops
 * are entered or passed through (ENTER_OR_PASS_THROUGH), so this walk ends inside the field.
 */
const WALK_INTO = [WALKER_START, FIELD_POINT]
/**
 * Through the field and out of its far side, 20 ft: the walk ends outside the field, so it only
 * crosses it. It turns at the field's middle to keep clear of the spreader, who stands beyond it.
 */
const WALK_THROUGH = [WALKER_START, FIELD_POINT, { x: FIELD_POINT.x, y: 350 }]
const SCENE_ZONE_CAP = 64

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf whose Bite is a self heal of one hit point, to end a slow with a real heal. */
const selfHealWolf: CreatureAuthored = {
  ...plainWolf,
  features: plainWolf.features?.map((feature) =>
    feature.label !== 'Bite'
      ? feature
      : {
          ...feature,
          effects: feature.effects?.map((effect) => ({
            ...effect,
            invocation: {
              ...effect.invocation,
              triggerCode: 'ACTIVATED' as const,
              range: { id: effect.invocation.range.id, rangeKind: 'SELF' as const },
              targeting: { selectionKind: 'SELF' as const }
            },
            paths: effect.paths.slice(0, 1).map((path) =>
              !('resultBlock' in path)
                ? path
                : {
                    ...path,
                    pathCode: 'ON_USE' as const,
                    resultBlock: {
                      ...path.resultBlock,
                      outcomes: [
                        {
                          id: testUuid(0x1710),
                          effectKind: 'HEAL' as const,
                          valueKind: 'FIXED' as const,
                          scalingKind: 'NONE' as const,
                          amount: 1
                        }
                      ]
                    }
                  }
            )
          }))
        }
  )
}

const walkerActor = srdCreatureActor({ id: WALKER_ID, creature: selfHealWolf })

/**
 * The Character who holds the Caltrops acts first; the Wolf waits at the far side of the field. The
 * GM rolls the Wolf's saves: every die rolls `die` (zero-based, so 0 is a natural 1 and 19 a 20).
 */
function caltropsRoom(
  die: number,
  spatialEffects: Parameters<typeof actionRoom>[0]['spatialEffects'] = [],
  { walker = walkerActor, walkerAt = WALKER_START } = {}
) {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: SPREADER_ACTOR_ID, characterId: SPREADER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: SPREADER_ID, systemId: srdSystemRecord.id }
      },
      walker
    ],
    positions: { [WALKER_ID]: walkerAt },
    characterEquipment: [caltropsBagOf20],
    characterAction: (action) => action.label === caltropsBagOf20.label,
    autoRoll: 'GAME_MASTER',
    fallbackRoll: die,
    spatialEffects
  })
}

type Room = Awaited<ReturnType<typeof caltropsRoom>>

async function spreadCaltrops(room: Room) {
  const { answer } = await room.startAreaAction(FIELD_POINT)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The feet the Wolf's moves have cost it this Encounter: what the turn's movement readout shows. */
async function walkerFeetMoved(room: Room) {
  const movements = await runInDurableObject(room.room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage).documents('encounterTurnMovements')
  )
  return movements
    .filter(({ actorId }) => actorId === WALKER_ID)
    .reduce((total, { usedFeet }) => total + usedFeet, 0)
}

function walkerHitPoints(room: Room) {
  return hitPointsOf(room, WALKER_ID)
}

/** The stored effect without its row identity or JSON key order, which a restore may rewrite. */
function storedContent({
  _id,
  _creationTime,
  definitionJson,
  ...effect
}: Awaited<ReturnType<typeof walkerEffects>>[number]) {
  return { ...effect, definition: JSON.parse(definitionJson) as unknown }
}

async function walkerEffects(room: Room) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  return activeEffects.filter(({ targetActorId }) => targetActorId === WALKER_ID)
}

describe('spreading Caltrops (SPELLS-17)', () => {
  it('stores one fixed zone at the chosen point with the authored label', async () => {
    const room = await caltropsRoom(19)
    await spreadCaltrops(room)

    const zones = await readZones(room)
    expect(zones).toHaveLength(1)
    expect(zones[0]).toMatchObject({
      encounterId: room.room.encounterId,
      sceneId: room.room.scene.id,
      placement: {
        label: 'Caltrop field',
        sourceTokenId: null,
        geometry: {
          frame: 'SCENE_ABSOLUTE',
          shape: {
            kind: 'POLYGON',
            points: [
              { x: 200, y: 100 },
              { x: 300, y: 100 },
              { x: 300, y: 200 },
              { x: 200, y: 200 }
            ]
          }
        }
      }
    })
  })

  it('refuses a designation of unaffected creatures, because Caltrops lets the caster spare no one', async () => {
    const room = await caltropsRoom(0)
    const before = await readRoomHistory(room.room.base.stub)

    const { answer } = await room.startAreaAction(FIELD_POINT, [], 'GM', [WALKER_ID])

    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    expect(await readZones(room)).toEqual([])
    expect(vitalsOf(await readRoomHistory(room.room.base.stub))).toEqual(vitalsOf(before))
  })

  it('removes the field with the Action when the GM takes it back', async () => {
    const room = await caltropsRoom(0)
    const before = await readRoomHistory(room.room.base.stub)
    await spreadCaltrops(room)
    expect(await readZones(room)).toHaveLength(1)

    await revertLastAction(room)
    expect(await readZones(room)).toEqual([])
    expect(vitalsOf(await readRoomHistory(room.room.base.stub))).toEqual(vitalsOf(before))

    // With the field gone, the Wolf walks the whole path and no entry runs.
    await room.advanceTurn()
    const walk = await room.room.move(
      WALK_INTO,
      await room.version(),
      room.room.scene.version,
      room.room.scene.tokens[1]!.id
    )
    expect(walk).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { position: FIELD_POINT } } }
    })
    expect(
      (await room.room.receipts()).filter(({ commandType }) => commandType === 'MOVE_SCENE_TOKEN')
    ).toEqual([])
  })

  it('refuses to spread once the Scene holds its limit of zones, spending nothing', async () => {
    const filler = Array.from({ length: SCENE_ZONE_CAP }, (_, variant) => ({
      center: { x: 900 + (variant % 8) * 20, y: 900 + Math.floor(variant / 8) * 20 },
      radius: 5,
      variant
    }))
    const room = await caltropsRoom(0, filler)
    expect(await readZones(room)).toHaveLength(SCENE_ZONE_CAP)
    const before = await readRoomHistory(room.room.base.stub)

    const { answer } = await room.startAreaAction(FIELD_POINT)

    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    expect(await readZones(room)).toHaveLength(SCENE_ZONE_CAP)
    expect(vitalsOf(await readRoomHistory(room.room.base.stub))).toEqual(vitalsOf(before))
  })

  it('catches nobody it is spread over: a token already in the field is tested on entering, not on spreading', async () => {
    const room = await caltropsRoom(0, [], { walkerAt: FIELD_POINT })
    const hitPointsBefore = await walkerHitPoints(room)

    const { answer } = await room.startAreaAction(FIELD_POINT)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readZones(room)).toHaveLength(1)
    expect(await walkerHitPoints(room)).toBe(hitPointsBefore)
    expect(await walkerEffects(room)).toEqual([])
  })
})

describe('entering a caltrop field (SPELLS-17)', () => {
  it('stops a creature that fails the save, hurts it and slows it by 10 feet', async () => {
    const room = await caltropsRoom(0)
    await spreadCaltrops(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)

    const walk = await walkerMoves(room, WALK_INTO)

    expect(walk.executions).toHaveLength(1)
    expect(walk.executions[0]).toMatchObject({
      execution: { movementInterruption: { kind: 'STOP' } },
      applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: 1 })]
    })
    // It stops where its footprint first touches the field, short of the middle it aimed for.
    expect(walk.terminalPosition.x).toBeGreaterThan(FIELD_POINT.x)
    expect(await walkerHitPoints(room)).toBe((hitPointsBefore ?? 0) - 1)
    const effects = await walkerEffects(room)
    expect(effects).toHaveLength(1)
    expect(JSON.parse(effects[0]!.definitionJson).stateContributions).toMatchObject([
      { kind: 'MODIFIER_GRANT' }
    ])
    expect(effects[0]!.definitionJson).toContain('"amount":10')
  })

  it('lets a creature that makes the save walk on, unhurt and unslowed', async () => {
    const room = await caltropsRoom(19)
    await spreadCaltrops(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)

    const walk = await walkerMoves(room, WALK_INTO)

    expect(walk.terminalPosition).toEqual(FIELD_POINT)
    expect(walk.executions[0]?.execution.movementInterruption ?? null).toBeNull()
    expect(await walkerHitPoints(room)).toBe(hitPointsBefore)
    expect(await walkerEffects(room)).toEqual([])
  })

  it('keeps one slow when the creature is caught by the field again', async () => {
    const room = await caltropsRoom(0)
    await spreadCaltrops(room)
    await room.advanceTurn()
    const first = await walkerMoves(room, WALK_INTO)
    const hitPointsAfterFirst = await walkerHitPoints(room)
    expect(await walkerEffects(room)).toHaveLength(1)

    // Back out of the field and in again: more damage, but still the one reduction.
    await walkerMoves(room, [first.terminalPosition, WALKER_START])
    await walkerMoves(room, [WALKER_START, FIELD_POINT])

    expect(await walkerHitPoints(room)).toBe((hitPointsAfterFirst ?? 0) - 1)
    expect(await walkerEffects(room)).toHaveLength(1)
  })
})

describe('passing through a caltrop field (SPELLS-17.2)', () => {
  it('stops a creature that fails the save inside the field, though its move ended beyond it', async () => {
    const room = await caltropsRoom(0)
    await spreadCaltrops(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)

    const walk = await walkerMoves(room, WALK_THROUGH)

    expect(walk.executions).toHaveLength(1)
    expect(walk.executions[0]).toMatchObject({
      execution: { movementInterruption: { kind: 'STOP' } },
      applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: 1 })]
    })
    // It stops where its footprint first touches the field, still on the first leg of the path.
    expect(walk.terminalPosition.y).toBe(FIELD_POINT.y)
    expect(walk.terminalPosition.x).toBeGreaterThan(FIELD_POINT.x)
    expect(walk.terminalPosition.x).toBeLessThan(WALKER_START.x)
    expect(await walkerHitPoints(room)).toBe((hitPointsBefore ?? 0) - 1)
    expect(await walkerEffects(room)).toHaveLength(1)
  })

  it('lets a creature that makes the save carry on to the end of its move, unhurt and unslowed', async () => {
    const room = await caltropsRoom(19)
    await spreadCaltrops(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)

    const walk = await walkerMoves(room, WALK_THROUGH)

    expect(walk.terminalPosition).toEqual(WALK_THROUGH.at(-1))
    expect(walk.executions[0]?.execution.movementInterruption ?? null).toBeNull()
    expect(await walkerHitPoints(room)).toBe(hitPointsBefore)
    expect(await walkerEffects(room)).toEqual([])
  })

  it('is bypassed by a careful crossing, which reaches the end of its move for the half-speed cost', async () => {
    const plain = await caltropsRoom(19)
    await spreadCaltrops(plain)
    await plain.advanceTurn()
    await walkerMoves(plain, WALK_THROUGH)
    const normalFeet = await walkerFeetMoved(plain)

    // Every die rolls a natural 1, so a save asked of the Wolf would fail.
    const room = await caltropsRoom(0)
    await spreadCaltrops(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)

    const walk = await walkerMoves(room, WALK_THROUGH, true)

    expect(walk.terminalPosition).toEqual(WALK_THROUGH.at(-1))
    expect(walk.executions).toEqual([])
    expect(await walkerFeetMoved(room)).toBeGreaterThan(normalFeet)
    expect(await walkerHitPoints(room)).toBe(hitPointsBefore)
    expect(await walkerEffects(room)).toEqual([])
  })
})

describe('crossing a caltrop field carefully (SPELLS-17)', () => {
  it('walks the same path for 5 ft more per square of the field, and is never asked to save', async () => {
    const plain = await caltropsRoom(19)
    await spreadCaltrops(plain)
    await plain.advanceTurn()
    await walkerMoves(plain, WALK_INTO)
    const normalFeet = await walkerFeetMoved(plain)

    // Every die rolls a natural 1, so a save asked of the Wolf would fail.
    const room = await caltropsRoom(0)
    await spreadCaltrops(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)

    await walkerMoves(room, WALK_INTO, true)

    // The Wolf's 100-unit footprint overlaps the 100-unit field over one cell of this path.
    expect(await walkerFeetMoved(room)).toBe(normalFeet + 5)
    expect(await walkerHitPoints(room)).toBe(hitPointsBefore)
    expect(await walkerEffects(room)).toEqual([])
  })
})

describe('a hidden field flagged for half-speed passage (SPELLS-17)', () => {
  const HIDDEN_FIELD = [
    { center: { x: 350, y: 150 }, radius: 30, save: true, hiddenHalfSpeedField: true }
  ]
  const ACROSS = [WALKER_START, FIELD_POINT]

  it('still triggers on a creature that says it moves carefully, at the plain cost', async () => {
    const plain = await caltropsRoom(0, HIDDEN_FIELD)
    await plain.advanceTurn()
    const plainWalk = await walkerMoves(plain, ACROSS)
    const plainFeet = await walkerFeetMoved(plain)
    expect(plainWalk.executions).toHaveLength(1)

    // A creature cannot choose to pass carefully a field it has not seen.
    const room = await caltropsRoom(0, HIDDEN_FIELD)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)
    const walk = await walkerMoves(room, ACROSS, true)

    expect(walk.executions).toHaveLength(1)
    expect(await walkerHitPoints(room)).toBe((hitPointsBefore ?? 0) - 1)
    expect(await walkerFeetMoved(room)).toBe(plainFeet)
  })
})

describe('a concealed caltrop field (MOVE-3.6)', () => {
  /** The GM conceals the spread field: only its spreader knows of it. */
  async function concealField(room: Room) {
    const [zone] = await readZones(room)
    const set = await room.send({
      type: 'SET_ZONE_DCS',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      spatialEffectId: zone!.id,
      spotDc: { value: 14, source: 'FLAT' },
      disarmDc: null
    })
    expect(set.type, JSON.stringify(set)).toBe('COMMAND_COMMITTED')
  }

  it('triggers on a creature that has not noticed it, though it says it moves carefully, at the plain cost', async () => {
    const plain = await caltropsRoom(0)
    await spreadCaltrops(plain)
    await concealField(plain)
    await plain.advanceTurn()
    await walkerMoves(plain, WALK_INTO)
    const plainFeet = await walkerFeetMoved(plain)

    const room = await caltropsRoom(0)
    await spreadCaltrops(room)
    await concealField(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)
    const walk = await walkerMoves(room, WALK_INTO, true)

    expect(walk.executions).toHaveLength(1)
    expect(await walkerHitPoints(room)).toBe((hitPointsBefore ?? 0) - 1)
    expect(await walkerFeetMoved(room)).toBe(plainFeet)
  })

  it('is still crossed carefully by the creature that knows of it', async () => {
    const room = await caltropsRoom(0)
    await spreadCaltrops(room)
    await concealField(room)

    // The spreader, still on its turn, steps into its own field with care: a save would fail.
    const walk = await walkerMoves(room, [{ x: 150, y: 150 }, FIELD_POINT], true, 0)

    expect(walk.terminalPosition).toEqual(FIELD_POINT)
    expect(walk.executions).toEqual([])
  })
})

describe('the Caltrops journey (SPELLS-17.1)', () => {
  it('spreads, is taken back, spreads again, snares a walker, is healed and is crossed with care', async () => {
    const room = await caltropsRoom(0)

    // The GM takes the first spread back and the field goes with it.
    await spreadCaltrops(room)
    expect(await readZones(room)).toHaveLength(1)
    await revertLastAction(room)
    expect(await readZones(room)).toEqual([])

    // Spread again: the Wolf walks in, fails the save, stops, is hurt and slowed.
    await spreadCaltrops(room)
    expect(await readZones(room)).toHaveLength(1)
    await room.advanceTurn()
    const fullHitPoints = await walkerHitPoints(room)
    const caught = await walkerMoves(room, WALK_INTO)
    expect(caught.executions[0]).toMatchObject({
      execution: { movementInterruption: { kind: 'STOP' } }
    })
    expect(caught.terminalPosition.x).toBeGreaterThan(FIELD_POINT.x)
    expect(await walkerHitPoints(room)).toBe((fullHitPoints ?? 0) - 1)
    expect(await walkerEffects(room)).toHaveLength(1)

    // A heal of one hit point ends the slow.
    const healed = await room.startAction(
      WALKER_ID,
      [],
      null,
      null,
      room.featureActionId(walkerActor, creatureFeature(selfHealWolf, 'Bite').id),
      WALKER_ID
    )
    expect(healed.answer.type, JSON.stringify(healed.answer)).toBe('COMMAND_COMMITTED')
    expect(await walkerHitPoints(room)).toBe(fullHitPoints)
    expect(await walkerEffects(room)).toEqual([])

    // Out of the field and back through it carefully: no save, no damage, no slow.
    await walkerMoves(room, [caught.terminalPosition, WALKER_START])
    const feetBefore = await walkerFeetMoved(room)
    await walkerMoves(room, WALK_INTO, true)
    expect(await walkerFeetMoved(room)).toBe(feetBefore + 15)
    expect(await walkerHitPoints(room)).toBe(fullHitPoints)
    expect(await walkerEffects(room)).toEqual([])
  })
})

describe('ending a caltrop slow (SPELLS-17)', () => {
  it('ends the reduction when the creature regains at least 1 hit point', async () => {
    const room = await caltropsRoom(0)
    await spreadCaltrops(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)
    await walkerMoves(room, WALK_INTO)
    expect(await walkerEffects(room)).toHaveLength(1)

    const healed = await room.startAction(
      WALKER_ID,
      [],
      null,
      null,
      room.featureActionId(walkerActor, creatureFeature(selfHealWolf, 'Bite').id),
      WALKER_ID
    )
    expect(healed.answer.type, JSON.stringify(healed.answer)).toBe('COMMAND_COMMITTED')

    expect(await walkerHitPoints(room)).toBe(hitPointsBefore)
    expect(await walkerEffects(room)).toEqual([])
  })

  it('keeps the reduction through a heal that restores nothing', async () => {
    // Five temporary hit points soak up the caltrop's damage, so the slow lands at full health.
    const tempWalker = srdCreatureActor({
      id: WALKER_ID,
      creature: selfHealWolf,
      tempHitPoints: 5
    })
    const room = await caltropsRoom(0, [], { walker: tempWalker })
    await spreadCaltrops(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)
    await walkerMoves(room, WALK_INTO)
    expect(await walkerHitPoints(room)).toBe(hitPointsBefore)
    expect(await walkerEffects(room)).toHaveLength(1)

    const healed = await room.startAction(
      WALKER_ID,
      [],
      null,
      null,
      room.featureActionId(tempWalker, creatureFeature(selfHealWolf, 'Bite').id),
      WALKER_ID
    )
    expect(healed.answer.type, JSON.stringify(healed.answer)).toBe('COMMAND_COMMITTED')

    expect(await walkerHitPoints(room)).toBe(hitPointsBefore)
    expect(await walkerEffects(room)).toHaveLength(1)
  })

  it('gives the slow back when the GM takes the healing back', async () => {
    const room = await caltropsRoom(0)
    await spreadCaltrops(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)
    await walkerMoves(room, WALK_INTO)
    const [slow] = await walkerEffects(room)
    const hitPointsHurt = await walkerHitPoints(room)

    const healed = await room.startAction(
      WALKER_ID,
      [],
      null,
      null,
      room.featureActionId(walkerActor, creatureFeature(selfHealWolf, 'Bite').id),
      WALKER_ID
    )
    expect(healed.answer.type, JSON.stringify(healed.answer)).toBe('COMMAND_COMMITTED')
    expect(await walkerHitPoints(room)).toBe(hitPointsBefore)
    expect(await walkerEffects(room)).toEqual([])

    await revertLastAction(room)

    expect(await walkerHitPoints(room)).toBe(hitPointsHurt)
    expect((await walkerEffects(room)).map(storedContent)).toEqual([slow].map(storedContent))
  })

  it('still slows a creature whose resistance takes the whole of the hurt', async () => {
    const resistantWalker = srdCreatureActor({
      id: WALKER_ID,
      creature: {
        ...selfHealWolf,
        damageResistances: [
          srdSystemRecord.damageTypes!.find(({ code }) => code === 'PIERCING')!.id
        ]
      }
    })
    const room = await caltropsRoom(0, [], { walker: resistantWalker })
    await spreadCaltrops(room)
    await room.advanceTurn()
    const hitPointsBefore = await walkerHitPoints(room)

    const caught = await walkerMoves(room, WALK_INTO)

    // Half of one point of piercing is nothing, yet the failed save still stops and slows the walker.
    expect(caught.executions[0]).toMatchObject({
      execution: { movementInterruption: { kind: 'STOP' } }
    })
    expect(await walkerHitPoints(room)).toBe(hitPointsBefore)
    expect(await walkerEffects(room)).toHaveLength(1)
  })

  it('keeps the reduction through more damage', async () => {
    const room = await caltropsRoom(0)
    await spreadCaltrops(room)
    await room.advanceTurn()
    const first = await walkerMoves(room, WALK_INTO)
    const hitPointsAfterFirst = await walkerHitPoints(room)
    const [slow] = await walkerEffects(room)

    await walkerMoves(room, [first.terminalPosition, WALKER_START])
    await walkerMoves(room, [WALKER_START, FIELD_POINT])

    expect(await walkerHitPoints(room)).toBe((hitPointsAfterFirst ?? 0) - 1)
    expect(await walkerEffects(room)).toEqual([slow])
  })
})
