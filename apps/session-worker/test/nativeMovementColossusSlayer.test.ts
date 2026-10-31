import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { reactionClub } from './reactionClubFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T4i: the SRD Hunter's Colossus Slayer, as authored, rides on a Character's opportunity
 * attack only against a target below its hit point maximum, and spends the turn's use when it does.
 */

const FIGHTER_ACTOR_ID = testUuid(0xe20)
const FIGHTER_ID = testUuid(0xe21)
const WOLF_ID = testUuid(0xe22)

/** The 1d8 the rider adds, rolling its minimum. */
const RIDER_DAMAGE = 1

const WOLF_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const colossusSlayerOption = hunterConclave.features
  ?.find(({ label }) => label === "Hunter's Prey")
  ?.options?.find(({ label }) => label === 'Colossus Slayer')
if (!colossusSlayerOption?.effects) throw new Error('The SRD Hunter has no Colossus Slayer.')

/** The SRD option as the Character's Feature, exactly as authored. */
const colossusSlayer: ClassFeature = {
  id: colossusSlayerOption.id,
  label: colossusSlayerOption.label,
  description: colossusSlayerOption.description,
  availableAtLevel: 1,
  order: 1,
  effects: colossusSlayerOption.effects
}

/**
 * The Wolf, at `currentHitPoints`, walks out of the Fighter's reach and takes its opportunity
 * attack. Returns the hit points the Wolf lost and the once-per-turn uses the Fighter's turn record
 * then holds.
 */
async function wolfHitPointsLostToOpportunityAttack(currentHitPoints: number) {
  const room = await movementRoom({
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, currentHitPoints })
    ],
    moverActorId: WOLF_ID,
    positions: {
      [FIGHTER_ACTOR_ID]: { x: 50, y: 150 },
      [WOLF_ID]: WOLF_START
    },
    autoRoll: 'BOTH',
    characterClassFeatures: [colossusSlayer],
    characterEquipment: [reactionClub],
    // The attack is a 19 and hits; every later die rolls the minimum.
    rolls: [18],
    fallbackRoll: 0
  })
  const hitPoints = async () => {
    const wolf = vitalsOf(await readRoomHistory(room.base.stub)).find(({ id }) => id === WOLF_ID)
    if (wolf?.currentHitPoints === undefined) throw new Error('The Wolf holds no hit points.')
    return wolf.currentHitPoints
  }
  const before = await hitPoints()
  const moved = await room.move([WOLF_START, { x: 450, y: 150 }])
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  const option = pending.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  const used = await room.respond({ kind: 'OPTION', optionId: option.optionId })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  const records = await runInDurableObject(room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage).documents('encounterTurnMovements')
  )
  return {
    lost: before - (await hitPoints()),
    spentUses: records
      .filter(({ actorId }) => actorId === FIGHTER_ACTOR_ID)
      .flatMap((record) => record.usedOncePerTurn)
  }
}

describe('an opportunity attack with the SRD Colossus Slayer (SPELLS-31.T4i)', () => {
  it('adds the rider against a wounded target, not a healthy one, and spends the turn’s use', async () => {
    const wounded = await wolfHitPointsLostToOpportunityAttack(plainWolf.hitPoints - 1)
    const healthy = await wolfHitPointsLostToOpportunityAttack(plainWolf.hitPoints)
    expect(wounded.lost - healthy.lost).toBe(RIDER_DAMAGE)
    expect(wounded.spentUses).toEqual([colossusSlayer.id])
    expect(healthy.spentUses).toEqual([])
  }, 60_000)
})
