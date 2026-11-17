import type { ZoneMoveDto } from '@artificer-toolkit/schema/effects/effectOffer'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { SpatialGeometry, SpatialSceneToken } from '@artificer-toolkit/shared/vtt'
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

/**
 * Whom a move that rams (QUALITY-15.T3y8c) rams and where it stops: the first creature (a token bound
 * to an actor) whose space the zone's center enters on its straight way to `destination`, stopped
 * where the center meets that space. A creature whose space the center starts in, or whose edge the
 * center only runs along, is not rammed; ties along the way go by token id. Null when the move does
 * not ram or meets no creature, so the zone goes all the way.
 */
export function zoneMoveRam(input: {
  shape: SpatialGeometry
  move: ZoneMoveDto
  destination: ScenePoint
  tokens: readonly SpatialSceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
}): { targetActorId: string; tokenId: string; stop: ScenePoint } | null {
  if (!input.move.rams) return null
  const from = spatialGeometryCenter(input.shape)
  const delta = { x: input.destination.x - from.x, y: input.destination.y - from.y }
  let ram: { targetActorId: string; tokenId: string; entry: number } | null = null
  for (const token of input.tokens) {
    const targetActorId = input.actorIdByTokenId.get(token.id)
    const entry = targetActorId === undefined ? null : centerEntry(from, delta, token)
    if (
      targetActorId === undefined ||
      entry === null ||
      (ram && (ram.entry < entry || (ram.entry === entry && ram.tokenId < token.id)))
    )
      continue
    ram = { targetActorId, tokenId: token.id, entry }
  }
  return (
    ram && {
      targetActorId: ram.targetActorId,
      tokenId: ram.tokenId,
      stop: { x: from.x + delta.x * ram.entry, y: from.y + delta.y * ram.entry }
    }
  )
}

/**
 * The fraction of the way along `from + delta` at which the point first enters the inside of the
 * token's footprint, by clipping the segment to it on each axis. Null when it starts inside, stays
 * outside or only touches the edge.
 */
function centerEntry(from: ScenePoint, delta: ScenePoint, token: SpatialSceneToken) {
  let enter = 0
  let exit = 1
  for (const [start, step, center, half] of [
    [from.x, delta.x, token.position.x, token.width / 2],
    [from.y, delta.y, token.position.y, token.height / 2]
  ] as const) {
    const [low, high] = [center - half - start, center + half - start]
    if (step === 0) {
      if (low >= 0 || high <= 0) return null
      continue
    }
    const [near, far] = step > 0 ? [low / step, high / step] : [high / step, low / step]
    enter = Math.max(enter, near)
    exit = Math.min(exit, far)
  }
  const startsInside =
    Math.abs(from.x - token.position.x) < token.width / 2 &&
    Math.abs(from.y - token.position.y) < token.height / 2
  return startsInside || enter >= exit ? null : enter
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
