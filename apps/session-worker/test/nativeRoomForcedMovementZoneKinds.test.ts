import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, spatialDamageEffect } from '../src/testing/movementPlannerFixture.js'
import {
  actionRoom,
  directedAreaWolf,
  forceOnFailedSave,
  withCheckTotals
} from './actionRoomFixture.js'
import { answerAllSaves, tokenPositions } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf, revertLastAction } from './placedZoneRoomReads.js'

/**
 * SPELLS-4.T1j (D170): the area action and the Shove contest settle the zone contacts along the
 * forced path in their own commit, as the single-target action does. A token is 100 px, a cell 5 ft.
 */

const SOURCE_ID = testUuid(0xc10)
const TARGET_ID = testUuid(0xc11)
const SOURCE_AT: ScenePoint = { x: 150, y: 150 }
const TARGET_AT: ScenePoint = { x: 250, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** Seeds a damaging zone that FORCED movement triggers on entry or crossing. */
const seedZone =
  (zone: { center: ScenePoint; radius: number; save?: boolean }) =>
  async ({
    spatial,
    encounterId
  }: {
    spatial: { create(effect: Awaited<ReturnType<typeof spatialDamageEffect>>): Promise<unknown> }
    encounterId: string
  }) => {
    await spatial.create(
      await spatialDamageEffect({
        encounterId,
        targetActorId: TARGET_ID,
        movementKinds: ['VOLUNTARY', 'FORCED'],
        triggerModes: ['ENTER', 'CROSS'],
        activation: 'REPEATABLE',
        ...zone
      })
    )
  }

/** A Wolf whose 15-foot line pushes the one creature that fails its save exactly 10 feet away. */
async function lineRoom(
  zone: { center: ScenePoint; radius: number; save?: boolean },
  targetHitPoints?: number
) {
  const creature = forceOnFailedSave(
    directedAreaWolf({
      shapeKind: 'LINE',
      length: { amount: 15, unit: 'FEET' },
      width: { amount: 5, unit: 'FEET' }
    }),
    'AWAY_FROM_SOURCE',
    10
  )
  return actionRoom({
    rolls: [],
    fallbackRoll: 0,
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf, currentHitPoints: targetHitPoints })
    ],
    positions: { [SOURCE_ID]: SOURCE_AT, [TARGET_ID]: TARGET_AT },
    ownerFeatureId: creature.features.find(({ label }) => label === 'Bite')?.id,
    seed: seedZone(zone)
  })
}
type LineRoom = Awaited<ReturnType<typeof lineRoom>>

async function sweep(room: LineRoom) {
  const { answer } = await room.startDirectedAreaAction({ x: 200, y: 150 }, { x: 500, y: 150 })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  await answerAllSaves(room)
}

describe('an area’s forced movement through zones (SPELLS-4.T1j)', () => {
  it('settles the damage of a zone the pushed creature passes through', async () => {
    const room = await lineRoom({ center: { x: 350, y: 150 }, radius: 20 })
    const before = await hitPointsOf(room, TARGET_ID)

    await sweep(room)

    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 450, y: 150 })
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)
  })

  it('settles the damage of a zone the pushed creature lands in', async () => {
    const room = await lineRoom({ center: { x: 450, y: 150 }, radius: 20 })
    const before = await hitPointsOf(room, TARGET_ID)

    await sweep(room)

    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 450, y: 150 })
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)
  })

  it('stops the creature where a zone drops it to 0 hit points, and that is its landing', async () => {
    const room = await lineRoom({ center: { x: 350, y: 150 }, radius: 20 }, 1)

    await sweep(room)

    expect(await hitPointsOf(room, TARGET_ID)).toBe(0)
    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 280, y: 150 })
  })

  it('rolls a save-or-damage zone with the room’s dice (homebrew zone)', async () => {
    const room = await lineRoom({ center: { x: 350, y: 150 }, radius: 20, save: true })
    const before = await hitPointsOf(room, TARGET_ID)

    await sweep(room)

    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 450, y: 150 })
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)
  })

  it('puts the creature, and the damage a zone dealt it, back on the undo of the area', async () => {
    const room = await lineRoom({ center: { x: 350, y: 150 }, radius: 20 })
    const before = await hitPointsOf(room, TARGET_ID)
    await sweep(room)

    await revertLastAction(room)

    expect(tokenPositions(room)(TARGET_ID)).toEqual(TARGET_AT)
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before)
  })
})

const SHOVE_ACTION_ID = (() => {
  const definition = SRD_BASIC_ACTION_DEFINITIONS.find(
    ({ id }) => id === SRD_BASIC_ACTION_IDS.SHOVE
  )
  if (definition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Shove fixture.')
  return encounterBasicActionId(
    SOURCE_ID,
    SRD_BASIC_ACTION_IDS.SHOVE,
    definition.document.effects[0]!.id
  )
})()

/** The shover (Athletics +5) wins its contest against the target (+0) with a 20 against a 1. */
function shoveRoom(zone: { center: ScenePoint; radius: number; save?: boolean }, hp?: number) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [19, 0],
    fallbackRoll: 0,
    actors: [
      withCheckTotals(srdCreatureActor({ id: SOURCE_ID, creature: plainWolf }), {
        [SRD_ATHLETICS_SKILL_ID]: 5
      }),
      withCheckTotals(
        srdCreatureActor({ id: TARGET_ID, creature: plainWolf, currentHitPoints: hp }),
        { [SRD_ATHLETICS_SKILL_ID]: 0, [SRD_ACROBATICS_SKILL_ID]: 2 }
      )
    ],
    positions: { [SOURCE_ID]: SOURCE_AT, [TARGET_ID]: TARGET_AT },
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id,
    seed: seedZone(zone)
  })
}
type ShoveRoom = Awaited<ReturnType<typeof shoveRoom>>

async function pushAway(room: ShoveRoom) {
  const choices = await room.actionChoices(SOURCE_ID)
  const shove = choices.basicActionChoices.find(({ id }) => id === SHOVE_ACTION_ID)
  const options = shove?.target && 'choiceOptions' in shove.target ? shove.target.choiceOptions : []
  const option = options?.find(({ label }) => label === 'Push 5 feet away')
  if (!option) throw new Error('The room offers no push option.')
  const { answer } = await room.startAction(
    TARGET_ID,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    SHOVE_ACTION_ID,
    SOURCE_ID,
    option.id
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('a Shove contest’s forced movement into zones (SPELLS-4.T1j)', () => {
  // A one-cell push cannot pass through a zone and leave it: it enters or it does not.
  it('settles the damage of a zone the shoved creature lands in', async () => {
    const room = await shoveRoom({ center: { x: 380, y: 150 }, radius: 20 })
    const before = await hitPointsOf(room, TARGET_ID)

    await pushAway(room)

    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 350, y: 150 })
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)
  })

  it('stops the creature where a zone drops it to 0 hit points, and that is its landing', async () => {
    const room = await shoveRoom({ center: { x: 380, y: 150 }, radius: 20 }, 1)

    await pushAway(room)

    expect(await hitPointsOf(room, TARGET_ID)).toBe(0)
    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 310, y: 150 })
  })

  it('rolls a save-or-damage zone with the room’s dice (homebrew zone)', async () => {
    const room = await shoveRoom({ center: { x: 380, y: 150 }, radius: 20, save: true })
    const before = await hitPointsOf(room, TARGET_ID)

    await pushAway(room)

    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 350, y: 150 })
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)
  })

  it('keeps refusing the undo of a contest, with the creature and the zone damage left as they are', async () => {
    const room = await shoveRoom({ center: { x: 380, y: 150 }, radius: 20 })
    const before = await hitPointsOf(room, TARGET_ID)
    await pushAway(room)

    const refused = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })

    expect(refused).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'REVERT_UNAVAILABLE' })
    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 350, y: 150 })
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)
  })
})
