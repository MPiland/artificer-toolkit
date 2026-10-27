import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ScenePoint, SpatialTokenFootprint } from '@artificer-toolkit/shared/vtt'
import { pathEntersZone } from './vttSceneRenderer.model'

export type HalfSpeedField = EncounterSessionStateDto['halfSpeedFields'][number]

/**
 * The fields a dragged token's footprint passes through on its path, in the room's order, leaving
 * out a concealed one its mover has not noticed: that mover gets no "Move carefully" offer, and
 * entering triggers the zone (MOVE-3.6).
 */
export function halfSpeedFieldsEntered({
  fields,
  placedZones,
  moverActorId,
  path,
  token
}: {
  fields: readonly HalfSpeedField[]
  placedZones: EncounterSessionStateDto['placedZones']
  moverActorId: string
  path: readonly ScenePoint[]
  token: SpatialTokenFootprint
}): HalfSpeedField[] {
  const unnoticedIds = new Set(
    placedZones.flatMap(({ id, unawareActorIds }) =>
      unawareActorIds.includes(moverActorId) ? [id] : []
    )
  )
  return fields.filter(
    ({ id, shape }) => !unnoticedIds.has(id) && pathEntersZone(shape, path, token)
  )
}
