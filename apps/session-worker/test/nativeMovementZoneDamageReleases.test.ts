import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { endTriggerEffectSeed } from './endTriggerEffectSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-14.T2d2: the damage a zone deals a creature as it moves releases what its ended effects
 * gave (their temporary hit points) and gives the grants the creature's passive damage triggers owe,
 * in the move's own commit, as the turn zone and an action's damage do.
 */

const WOLF_ID = testUuid(0xe62)
const EFFECT_ID = testUuid(0x5661)
const WOLF_START: ScenePoint = { x: 150, y: 150 }
const WOLF_END: ScenePoint = { x: 450, y: 150 }
/** Covers one cell of the row the Wolf walks along and deals 1 fire damage. */
const fireZone = { center: { x: 350, y: 150 }, radius: 50 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Wolf with the Flesh Golem's Aversion of Fire, which grants disadvantage after fire damage. */
const aversionWolf: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0xe63),
  features: [
    ...(plainWolf.features ?? []),
    creatureFeature(srdByLabel(SRD.creatures, 'Flesh Golem'), 'Aversion of Fire')
  ]
}

describe('zone damage against a mover (QUALITY-14.T2d2)', () => {
  it('releases the temporary hit points of the effect it ends', async () => {
    // The Wolf holds 5 temporary hit points its SRD Invisibility effect gave it (the pool's source,
    // D156), an effect that here ends when it takes damage.
    const room = await movementRoom({
      actors: [
        {
          ...srdCreatureActor({ id: WOLF_ID, creature: plainWolf, tempHitPoints: 5 }),
          tempHitPointsSourceEffectId: EFFECT_ID
        }
      ],
      moverActorId: WOLF_ID,
      positions: { [WOLF_ID]: WOLF_START },
      autoRoll: 'GAME_MASTER',
      spatialEffects: [fireZone],
      seed: endTriggerEffectSeed({
        effectId: EFFECT_ID,
        holderActorId: WOLF_ID,
        sourceActorId: WOLF_ID,
        triggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }]
      })
    })
    const moved = await room.move([WOLF_START, WOLF_END])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.base.stub)

    expect(history.activeEffects.map(({ id }) => id)).toEqual([])
    // The fire spends 1 of the 5 temporary hit points; the rest leave with the effect.
    expect(vitalsOf(history).find(({ id }) => id === WOLF_ID)).toMatchObject({
      currentHitPoints: plainWolf.hitPoints,
      tempHitPoints: 0
    })
  }, 60_000)

  it('gives the mover the grant its passive damage trigger owes', async () => {
    const room = await movementRoom({
      actors: [srdCreatureActor({ id: WOLF_ID, creature: aversionWolf })],
      moverActorId: WOLF_ID,
      positions: { [WOLF_ID]: WOLF_START },
      autoRoll: 'GAME_MASTER',
      spatialEffects: [fireZone]
    })
    const moved = await room.move([WOLF_START, WOLF_END])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    const effects = (await readRoomHistory(room.base.stub)).activeEffects

    expect(effects).toHaveLength(1)
    expect(effects[0]).toMatchObject({ targetActorId: WOLF_ID })
  }, 60_000)

  it('gives the mover nothing when the move crosses no zone', async () => {
    const room = await movementRoom({
      actors: [srdCreatureActor({ id: WOLF_ID, creature: aversionWolf })],
      moverActorId: WOLF_ID,
      positions: { [WOLF_ID]: WOLF_START },
      autoRoll: 'GAME_MASTER',
      spatialEffects: [fireZone]
    })
    const moved = await room.move([WOLF_START, { x: 150, y: 350 }])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')

    expect((await readRoomHistory(room.base.stub)).activeEffects).toEqual([])
  }, 60_000)
})
