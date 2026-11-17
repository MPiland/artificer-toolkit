import { describe, expect, it } from 'vitest'

import type { ManifestAuthored } from '@artificer-toolkit/shared/authored'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { placedZoneLights } from '../actorLight.js'
import { evaluateEncounterZoneTarget } from '../encounterAreaAction.js'
import { planEncounterEnvironmentalZone } from '../encounterEnvironmentalZone.js'
import { planEncounterPlacedZone, plannedSpatialEffectRecord } from '../encounterPlacedZone.js'
import { resolveEncounterActorPairPerception } from '../encounterTurnEffectPerception.js'
import {
  carryingZone,
  environmentalZones,
  zonePlacementOf
} from '../testing/authoredZoneFixture.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureActor,
  creatureEncounter,
  srdAttackPerceptionLoaders
} from './encounterCreatureAction.js'
import { brightZoneScene, ZONE_GRID, zoneToken } from './spatialZoneFixture.js'

/** QUALITY-15.T3v4: the light a zone manifest authors lights the Scene for perception. */

type ZoneLight = NonNullable<Extract<ManifestAuthored, { manifestKind: 'ZONE' }>['light']>

// Bright 20 feet out from the zone's edge and dim 20 feet more: 400 and 800 Scene coordinates.
const LIGHT: ZoneLight = {
  bright: { amount: 20, unit: 'FEET' },
  dimAdditional: { amount: 20, unit: 'FEET' }
}
// Clear of both tokens, close enough that its bright light reaches the subject's centre at x 50.
const POINT = { x: 350, y: 50 }
const { caltropField, pit } = environmentalZones()
const litField = { ...caltropField, light: LIGHT }

/** The zone an item carrying `zone` leaves at {@link POINT}, as the Scene's effect store keeps it. */
function placeByItem(zone: Parameters<typeof carryingZone>[0]) {
  const compiled = zonePlacementOf(carryingZone(zone))
  const area = evaluateEncounterZoneTarget({
    zone: compiled,
    range: { id: testUuid(0x3c06), rangeKind: 'UNLIMITED' },
    target: { kind: 'POINT', point: POINT },
    grid: ZONE_GRID,
    sourceToken: null,
    aimSeen: true
  })
  if ('refusal' in area) throw new Error(`The item zone must place: ${area.refusal}.`)
  const placed = planEncounterPlacedZone({
    id: testUuid(0x3c03),
    zone: compiled,
    maintainedEffectStateId: null,
    encounterId: testUuid(0x3c00),
    occurrenceId: testUuid(0x3c04),
    rootCommandId: testUuid(0x3c04),
    sourceActorId: testUuid(0x3c05),
    point: POINT,
    area: area.shape,
    sourceToken: null,
    saveDc: 13
  })
  return plannedSpatialEffectRecord(placed, {
    encounterId: testUuid(0x3c00),
    sceneId: testUuid(0x3c07),
    createdOrdinal: 1,
    createdAt: '2026-11-17T00:00:00.000Z'
  })
}

/** Whether a senseless observer at x 1650 sees a subject at x 50 in a dark Scene holding `zone`. */
async function observerSees(zone: Parameters<typeof carryingZone>[0]) {
  const observerId = testUuid(0x3cd1)
  const subjectId = testUuid(0x3cd2)
  const { movementTargets } = creatureEncounter([
    creatureActor({ id: observerId, label: 'Observer', features: [] }),
    creatureActor({ id: subjectId, label: 'Subject', features: [] })
  ])
  const observerToken = zoneToken(testUuid(0x3cd3), 'Observer', 1650)
  const subjectToken = zoneToken(testUuid(0x3cd4), 'Subject', 50)
  const result = await resolveEncounterActorPairPerception({
    ...srdAttackPerceptionLoaders(),
    requirement: 'SEE',
    observer: movementTargets.get(observerId)!,
    subject: movementTargets.get(subjectId)!,
    observerConditionDefinitions: [],
    subjectConditionDefinitions: [],
    placement: {
      scene: {
        ...brightZoneScene([observerToken, subjectToken]),
        ambientIllumination: 'ORDINARY_DARKNESS'
      },
      sceneGrid: ZONE_GRID,
      observerToken,
      subjectToken,
      spatialEffects: [placeByItem(zone)]
    }
  })
  return result.satisfied
}

describe('the light a placed zone sheds (QUALITY-15.T3v4)', () => {
  it('compiles the light its manifest authors, and none for a zone that authors none', () => {
    expect(zonePlacementOf(carryingZone(litField)).light).toEqual(LIGHT)
    expect(zonePlacementOf(carryingZone(caltropField))).not.toHaveProperty('light')
  })

  it('keeps the light on the placed zone’s record, placed by an item or by the GM', () => {
    expect(placeByItem(litField).placement.light).toEqual(LIGHT)
    expect(placeByItem(caltropField).placement).not.toHaveProperty('light')
    expect(
      planEncounterEnvironmentalZone({
        gameSystemId: SRD_SYSTEM_ID,
        conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
        abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
        zone: { ...pit, light: LIGHT },
        point: POINT,
        grid: ZONE_GRID,
        id: testUuid(0x3c01),
        encounterId: testUuid(0x3c00),
        rootCommandId: testUuid(0x3c02)
      }).placement.light
    ).toEqual(LIGHT)
  })

  it('sheds its light from the area it covers on the Scene, in Scene coordinates', () => {
    const record = placeByItem(litField)

    expect(placedZoneLights([record], brightZoneScene([]))).toEqual([
      {
        geometry: expect.objectContaining({ kind: record.placement.geometry.shape.kind }),
        brightRadius: 400,
        dimRadius: 800
      }
    ])
    expect(placedZoneLights([placeByItem(caltropField)], brightZoneScene([]))).toEqual([])
  })

  it('lets an observer see a creature its light reaches in the dark', async () => {
    expect(await observerSees(caltropField)).toBe(false)
    expect(await observerSees(litField)).toBe(true)
  })
})
