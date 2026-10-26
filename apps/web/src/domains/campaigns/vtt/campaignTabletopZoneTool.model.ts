import type { ManifestAuthored } from '@artificer-toolkit/shared/authored'
import {
  pointAreaInSceneCoordinates,
  pointAreaOfShape,
  type SceneGrid,
  type ScenePoint,
  type SpatialPointAreaShape
} from '@artificer-toolkit/shared/vtt'
import {
  placeZoneInputDtoSchema,
  type PlaceZoneInputDto
} from '@artificer-toolkit/schema/api/encounters'

/**
 * The zone a GM starts from (MOVE-3.2): a placed-space zone with a 10-foot radius and no
 * components yet. The GM authors it through the same zone node map as authored content.
 */
export function createPlacedZoneDraft(): ManifestAuthored {
  return {
    id: crypto.randomUUID(),
    effectKind: 'MANIFEST',
    manifestKind: 'ZONE',
    attachmentKind: 'PLACED_SPACE',
    shape: { id: crypto.randomUUID(), shapeKind: 'CIRCLE', radius: { amount: 10, unit: 'FEET' } },
    components: []
  }
}

/**
 * The zone's area on this Scene, centered on the picked point: a circle or a square. Null for a
 * shape a GM cannot place at a point, or a size that is scaled or empty.
 */
export function placedZoneSize(
  zone: Pick<ManifestAuthored, 'shape'>,
  grid: SceneGrid
): SpatialPointAreaShape | null {
  const area = zone.shape ? pointAreaOfShape(zone.shape) : null
  return area ? pointAreaInSceneCoordinates(area, grid) : null
}

/**
 * The command that places `zone` at `point`, or null when the zone is not a complete placed-space
 * zone the room accepts.
 */
export function placeZoneCommand(input: {
  zone: ManifestAuthored
  point: ScenePoint
  encounterId: string
  expectedVersion: number
}): PlaceZoneInputDto | null {
  const parsed = placeZoneInputDtoSchema.safeParse({
    type: 'PLACE_ZONE',
    commandId: crypto.randomUUID(),
    encounterId: input.encounterId,
    expectedVersion: input.expectedVersion,
    zone: input.zone,
    point: input.point
  })
  return parsed.success &&
    input.zone.manifestKind === 'ZONE' &&
    input.zone.attachmentKind === 'PLACED_SPACE'
    ? parsed.data
    : null
}
