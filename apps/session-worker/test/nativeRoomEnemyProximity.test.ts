import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  gatedSneakAttack,
  riderGate
} from '@artificer-toolkit/rules-runtime/testing/unconditionalSneakAttack'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const FIGHTER_ACTOR_ID = testUuid(0xe00)
const FIGHTER_ID = testUuid(0xe01)
const WOLF_ID = testUuid(0xe02)
const ALLY_ID = testUuid(0xe03)

/** The 1d6 the rider adds, rolling a 3. */
const RIDER_DAMAGE = 3

const incapacitated = srdSystemRecord.conditionTypes.find(({ code }) => code === 'INCAPACITATED')
if (!incapacitated) throw new Error('The SRD has no Incapacitated Condition.')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A homebrew Feature adding 1d6 of the weapon's type to a melee hit while an able enemy of the target is within 5 ft. */
function nearbyEnemyRider(): ClassFeature {
  const feature = gatedSneakAttack(
    testUuid(0xe10),
    riderGate([{ predicateCode: 'ENEMY_NEAR_TARGET', feet: 5 }])
  )
  return {
    ...feature,
    effects: feature.effects?.map((effect) => ({
      ...effect,
      paths: effect.paths.map((path) => {
        if (!('resultBlock' in path)) return path
        return {
          ...path,
          resultBlock: {
            ...path.resultBlock,
            outcomes: [
              {
                id: testUuid(0xe11),
                effectKind: 'DAMAGE' as const,
                usesTriggeringWeaponDamageType: true as const,
                valueKind: 'DICE' as const,
                scalingKind: 'NONE' as const,
                diceConfig: '1d6'
              }
            ]
          }
        }
      })
    }))
  }
}

/**
 * The Fighter's Club hit on the Wolf, with the Fighter's own Scene-measured rider. The Fighter's
 * ally (an enemy of the Wolf) stands `allyColumn` squares from the Fighter; the Wolf is at column 1.
 * Returns the Wolf's hit points lost: the Club's d4 rolls 1, the rider's d6 rolls 3.
 */
async function wolfHitPointsLost(input: {
  allyColumn: number
  allyConditionIds?: readonly string[]
  allyDefeated?: boolean
  withScene: boolean
}) {
  const room = await actionRoom({
    autoRoll: 'BOTH',
    rolls: [14, 0, 2],
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf }),
      srdCreatureActor({
        id: ALLY_ID,
        creature: plainWolf,
        disposition: 'FRIENDLY',
        conditionIds: input.allyConditionIds,
        ...(input.allyDefeated ? { defeated: true, currentHitPoints: 0 } : {})
      })
    ],
    positions: { [ALLY_ID]: { x: 150 + 100 * input.allyColumn, y: 150 } },
    characterPlay: { equipped: true },
    characterClassFeatures: [nearbyEnemyRider()],
    characterAction: (action) => action.label.includes('Club')
  })
  const before = vitalsOf(await readRoomHistory(room.room.base.stub)).find(
    ({ id }) => id === WOLF_ID
  )
  const { answer } = input.withScene
    ? await room.startAction(WOLF_ID, [], room.sceneContext())
    : await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const after = vitalsOf(await readRoomHistory(room.room.base.stub)).find(
    ({ id }) => id === WOLF_ID
  )
  if (before?.currentHitPoints === undefined || after?.currentHitPoints === undefined)
    throw new Error('The Wolf holds no hit points.')
  return before.currentHitPoints - after.currentHitPoints
}

describe('a rider owed while an able enemy of the target is within 5 ft, in the room (D119)', () => {
  // Column 0 is the Fighter, 1 the Wolf: the ally at column 2 is adjacent to the Wolf, at 5 is 20 ft off.
  const farLoss = () => wolfHitPointsLost({ allyColumn: 5, withScene: true })

  it('adds the rider when an ally of the attacker stands beside the target, and not when it stands 20 ft off', async () => {
    const near = await wolfHitPointsLost({ allyColumn: 2, withScene: true })
    expect(near - (await farLoss())).toBe(RIDER_DAMAGE)
  })

  it('does not count an incapacitated enemy of the target', async () => {
    const loss = await wolfHitPointsLost({
      allyColumn: 2,
      allyConditionIds: [incapacitated.id],
      withScene: true
    })
    expect(loss).toBe(await farLoss())
  })

  it('does not count a defeated enemy of the target', async () => {
    const loss = await wolfHitPointsLost({ allyColumn: 2, allyDefeated: true, withScene: true })
    expect(loss).toBe(await farLoss())
  })

  it('withholds the rider from an attack that names no Scene to measure on', async () => {
    const loss = await wolfHitPointsLost({ allyColumn: 2, withScene: false })
    expect(loss).toBe(await farLoss())
  })
})
