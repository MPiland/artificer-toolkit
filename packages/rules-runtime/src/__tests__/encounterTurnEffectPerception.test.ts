import { describe, expect, it } from 'vitest'

import { resolveEncounterActorPairPerception } from '../encounterTurnEffectPerception.js'
import {
  creatureActor,
  creatureEncounter,
  srdAttackPerceptionLoaders
} from './encounterCreatureAction.js'
import { brightZoneScene, darknessZone, ZONE_GRID, zoneToken } from './spatialZoneFixture.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

const OBSERVER_ID = testUuid(0xd1)
const SUBJECT_ID = testUuid(0xd2)

/**
 * Whether a senseless observer at x 850 sees a subject at x 50 (footprint x 0 to 100) when a
 * radius-50 zone of darkness lies at `zoneCenterX` on the same row.
 */
async function observerSees(zoneCenterX: number) {
  const observer = creatureActor({ id: OBSERVER_ID, label: 'Observer', features: [] })
  const subject = creatureActor({ id: SUBJECT_ID, label: 'Subject', features: [] })
  const { movementTargets } = creatureEncounter([observer, subject])
  const observerToken = zoneToken(testUuid(0xd3), 'Observer', 850)
  const subjectToken = zoneToken(testUuid(0xd4), 'Subject', 50)
  const result = await resolveEncounterActorPairPerception({
    ...srdAttackPerceptionLoaders(),
    requirement: 'SEE',
    observer: movementTargets.get(OBSERVER_ID)!,
    subject: movementTargets.get(SUBJECT_ID)!,
    observerConditionDefinitions: [],
    subjectConditionDefinitions: [],
    placement: {
      scene: brightZoneScene([observerToken, subjectToken]),
      sceneGrid: ZONE_GRID,
      observerToken,
      subjectToken,
      spatialEffects: [darknessZone({ x: zoneCenterX, y: 50 })]
    }
  })
  return result.satisfied
}

describe('actor-pair perception through a lasting zone (SPELLS-24)', () => {
  it('is not affected by a zone the subject footprint only touches', async () => {
    // The zone spans x 100 to 200: it shares only the subject's right edge.
    expect(await observerSees(150)).toBe(true)
  })

  it('is affected by a zone the subject footprint overlaps with positive area', async () => {
    // The zone spans x 90 to 190: it shares a strip of the subject's footprint.
    expect(await observerSees(140)).toBe(false)
  })
})
