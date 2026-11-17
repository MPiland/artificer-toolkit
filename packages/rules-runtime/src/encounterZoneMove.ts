import type { ZoneMoveDto } from '@artificer-toolkit/schema/effects/effectOffer'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import { measureSceneDistance } from '@artificer-toolkit/shared/vtt/geometry'
import type { SceneGrid, ScenePoint } from '@artificer-toolkit/shared/vtt/scene'
import { lengthMeasurementInSceneUnits } from '@artificer-toolkit/shared/vtt/sceneReducer'
import { spatialGeometryCenter } from '@artificer-toolkit/shared/vtt/spatialGeometryCenter'

type MovableZone = Pick<
  EncounterSpatialRuleEffectRecord,
  'definition' | 'placement' | 'maintainedEffectStateId'
>

/**
 * The authored move `actorId` may make with a zone (QUALITY-15.T3y8): the zone's own, while the actor
 * placed it and still maintains it. Null for a zone that stays put or that another creature placed.
 */
export function sourceZoneMove(zone: MovableZone, actorId: string): ZoneMoveDto | null {
  const { origin } = zone.definition
  if (origin.kind !== 'ENCOUNTER' || origin.sourceActorId !== actorId) return null
  return zone.maintainedEffectStateId ? (zone.placement.move ?? null) : null
}

/** Whether moving the zone so it is centered on `destination` stays within its move's distance. */
export function zoneMoveWithinDistance(input: {
  zone: MovableZone
  move: ZoneMoveDto
  destination: ScenePoint
  grid: SceneGrid
}): boolean {
  const from = spatialGeometryCenter(input.zone.placement.geometry.shape)
  return (
    measureSceneDistance(input.grid, from, input.destination) <=
    lengthMeasurementInSceneUnits(input.move.maxDistance, input.grid)
  )
}
