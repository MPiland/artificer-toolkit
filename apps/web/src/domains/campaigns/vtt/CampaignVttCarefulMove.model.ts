import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ScenePoint, SpatialTokenFootprint } from '@artificer-toolkit/shared/vtt'
import { pathEntersZone, type UnnoticedZone } from './vttSceneRenderer.model'

export type HalfSpeedField = EncounterSessionStateDto['halfSpeedFields'][number]

/**
 * The fields a dragged token's footprint passes through on its path, in the room's order, leaving
 * out a concealed one its mover has not noticed: that mover gets no "Move carefully" offer, and
 * entering triggers the zone (MOVE-3.6).
 */
export function halfSpeedFieldsEntered({
  session,
  moverActorId,
  path,
  token
}: {
  session: Pick<EncounterSessionStateDto, 'halfSpeedFields' | 'placedZones'>
  moverActorId: string
  path: readonly ScenePoint[]
  token: SpatialTokenFootprint
}): HalfSpeedField[] {
  const unnoticedIds = new Set(
    session.placedZones.flatMap(({ id, unawareActorIds }) =>
      unawareActorIds.includes(moverActorId) ? [id] : []
    )
  )
  return session.halfSpeedFields.filter(
    ({ id, shape }) => !unnoticedIds.has(id) && pathEntersZone(shape, path, token)
  )
}

/** The GM's concealed zones, each with the labels of the Run's actors that have not noticed it. */
export function unnoticedZonesOf({
  placedZones,
  encounter
}: Pick<EncounterSessionStateDto, 'placedZones' | 'encounter'>): UnnoticedZone[] {
  return placedZones
    .filter(({ unawareActorIds }) => unawareActorIds.length)
    .map(({ label, shape, unawareActorIds }) => ({
      label,
      shape,
      by: (encounter?.actors ?? []).flatMap((actor) =>
        unawareActorIds.includes(actor.id) ? [actor.label] : []
      )
    }))
}
