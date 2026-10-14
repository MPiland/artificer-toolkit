import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { SceneGrid, ScenePoint, SceneToken } from '@artificer-toolkit/shared/vtt'

import { testUuid } from '../testing/dnd5eSrdEncounter.js'

export const ZONE_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}

/** A 100 px token whose footprint spans x - 50 to x + 50 on the row y 0 to 100. */
export function zoneToken(id: string, label: string, x: number): SceneToken {
  return {
    id,
    assetId: null,
    controlledByUserIds: [],
    height: 100,
    width: 100,
    hidden: false,
    locked: false,
    label,
    rotationDegrees: 0,
    position: { x, y: 50 },
    senses: [],
    vision: null
  }
}

/** A bright Scene holding `tokens`; only a zone can darken it. */
export function brightZoneScene(tokens: readonly SceneToken[]) {
  return {
    ambientIllumination: 'BRIGHT' as const,
    barriers: [],
    darknessZones: [],
    doorStates: {},
    grid: ZONE_GRID,
    lights: [],
    tokens: [...tokens]
  }
}

/**
 * A lasting 50 px-radius zone of heavy magical darkness at `center`, reduced to the fields
 * perception reads: its placement and its locked illumination contribution.
 */
export function darknessZone(center: ScenePoint): EncounterSpatialRuleEffectRecord {
  return {
    id: testUuid(0x7a00),
    version: 1,
    createdOrdinal: 1,
    definitionChecksum: 'a'.repeat(64),
    definition: {
      perceptionContributions: [
        {
          id: testUuid(0x7a01),
          order: 0,
          kind: 'ILLUMINATION_EFFECT',
          illumination: 'MAGICAL_DARKNESS',
          obscurement: 'HEAVY',
          precedence: 1
        }
      ]
    },
    placement: {
      schemaVersion: 1,
      anchorKind: 'FIXED',
      sourceTokenId: null,
      geometry: { frame: 'SCENE_ABSOLUTE', shape: { kind: 'CIRCLE', center, radius: 50 } },
      triggerModes: ['CROSS'],
      movementKinds: ['VOLUNTARY'],
      activation: 'REPEATABLE',
      visibility: 'PUBLIC',
      revealOnTrigger: false
    }
  } as unknown as EncounterSpatialRuleEffectRecord
}
