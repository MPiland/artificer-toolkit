import {
  creatureFeature,
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { solar } from '@artificer-toolkit/source-data/srd/creatures/solar.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-33.T8b (D217): the Solar's authored Healing Touch heals the touched creature, frees it from
 * the blinded, deafened and poisoned conditions it holds (and leaves the others), and spends one of
 * its four daily charges.
 */

const SOLAR_ID = testUuid(0x9b0)
const PATIENT_ID = testUuid(0x9b1)
const STARTING_HIT_POINTS = 1
/** The raw die is its face less one, so every die of 8d8+4 rolls a 1: 12 hit points, above the Wolf's room. */
const LOW_ROLL = 0

const conditionId = (code: string) => {
  const found = srdSystemRecord.conditionTypes.find((condition) => condition.code === code)
  if (!found) throw new Error(`The SRD names the ${code} condition.`)
  return found.id
}
const FREED = ['BLINDED', 'DEAFENED', 'POISONED'].map(conditionId)
const KEPT = conditionId('FRIGHTENED')
const installedSolar = installedSrdCreature(solar)
const healingTouch = creatureFeature(installedSolar, 'Healing Touch (4/Day)')

afterEach(() => {
  closeTrackedSockets()
})

describe('Solar Healing Touch in the room (SPELLS-33.T8b)', () => {
  it('heals the target, frees it from the named conditions and spends a charge', async () => {
    const held = [...FREED, KEPT]
    const seeds = held.map((ownedConditionId) =>
      seedModifierGrant({
        sourceActorId: SOLAR_ID,
        holderActorId: PATIENT_ID,
        lifecycle: {},
        ownedConditionId
      })
    )
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: SOLAR_ID, creature: installedSolar, disposition: 'FRIENDLY' }),
        srdCreatureActor({
          id: PATIENT_ID,
          creature: plainWolf,
          currentHitPoints: STARTING_HIT_POINTS
        })
      ],
      ownerFeatureId: healingTouch.id,
      rolls: [LOW_ROLL],
      fallbackRoll: LOW_ROLL,
      seed: async (context) => {
        for (const seed of seeds) await seed(context)
      }
    })

    const { answer } = await room.startAction(PATIENT_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const history = await readRoomHistory(room.room.base.stub)
    expect(readActorHitPoints(history, PATIENT_ID)).toBe(plainWolf.hitPoints)
    expect([...readActorConditionIds(history, PATIENT_ID)]).toEqual([KEPT])
    const solarRow = history.actors.find(({ id }) => id === SOLAR_ID)
    const { resources } = JSON.parse(solarRow!.stateJson) as {
      resources: { featureCharges?: Record<string, number> }
    }
    expect(resources.featureCharges?.[healingTouch.id]).toBe(1)
  })
}, 120000)
