import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  spatialSegmentShareInside,
  type ScenePoint,
  type SpatialTokenFootprint
} from '@artificer-toolkit/shared/vtt'

export type HalfSpeedField = EncounterSessionStateDto['halfSpeedFields'][number]

/** The fields a dragged token's footprint passes through on its path, in the room's order. */
export function halfSpeedFieldsEntered({
  fields,
  path,
  token
}: {
  fields: readonly HalfSpeedField[]
  path: readonly ScenePoint[]
  token: SpatialTokenFootprint
}): HalfSpeedField[] {
  return fields.filter(({ shape }) =>
    path
      .slice(1)
      .some(
        (to, index) =>
          spatialSegmentShareInside({ geometries: [shape], token, from: path[index]!, to }) > 0
      )
  )
}
