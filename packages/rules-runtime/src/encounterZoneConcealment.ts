import type {
  SpatialGeometryDto,
  SpatialRuleEffectStateDto,
  ZoneDcDto
} from '@artificer-toolkit/schema/shared/spatial'

/** Who reads a placed zone: the GM, or a player through the Encounter actors they control. */
export type ZoneViewer =
  | { readonly kind: 'GM' }
  | { readonly kind: 'PLAYER'; readonly controlledActorIds: ReadonlySet<string> }

/**
 * Whether a placed zone is concealed from the viewer (MOVE-3.3): it has a spot DC and none of the
 * viewer's Characters knows of it. The GM sees every zone. Every read that draws or lists a zone
 * for a member applies it, so Convex and the room redact alike.
 */
export function zoneConcealedFrom(
  { concealment }: Pick<SpatialRuleEffectStateDto, 'concealment'>,
  viewer: ZoneViewer
): boolean {
  return (
    concealment !== undefined &&
    viewer.kind === 'PLAYER' &&
    !concealment.knownByActorIds.some((id) => viewer.controlledActorIds.has(id))
  )
}

/**
 * A zone's state with the GM's spot and disarm DCs; null clears one. A zone that becomes concealed
 * is known to its placer, and one that stays concealed keeps who knows of it.
 */
export function withZoneDcs(
  state: SpatialRuleEffectStateDto,
  input: { spotDc: ZoneDcDto | null; disarmDc: ZoneDcDto | null; placerActorId: string | null }
): SpatialRuleEffectStateDto {
  const knownByActorIds =
    state.concealment?.knownByActorIds ?? (input.placerActorId ? [input.placerActorId] : [])
  const sightings = state.concealment?.sightings ?? []
  return {
    schemaVersion: state.schemaVersion,
    revealed: state.revealed,
    ...(input.spotDc ? { concealment: { spotDc: input.spotDc, knownByActorIds, sightings } } : {}),
    ...(input.disarmDc ? { disarmDc: input.disarmDc } : {})
  }
}

/**
 * The Scene point a Character must see to notice a zone (MOVE-3.5): a circle's or ring's center,
 * or the mean of a polygon's points.
 */
export function zoneSightPoint(shape: SpatialGeometryDto): { x: number; y: number } {
  if (shape.kind !== 'POLYGON') return shape.center
  const sum = shape.points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    {
      x: 0,
      y: 0
    }
  )
  return { x: sum.x / shape.points.length, y: sum.y / shape.points.length }
}

/**
 * The Characters that could first notice a concealed zone: those that neither know of it nor
 * already have a sighting, so a replayed evaluation adds nothing.
 */
export function zoneSightingCandidates(
  { concealment }: SpatialRuleEffectStateDto,
  actorIds: readonly string[]
): string[] {
  if (!concealment) return []
  const settled = new Set([
    ...concealment.knownByActorIds,
    ...concealment.sightings.map(({ actorId }) => actorId)
  ])
  return actorIds.filter((actorId) => !settled.has(actorId))
}

/** A concealed zone's state with a PROMPTED sighting for each new candidate, sorted by actor. */
export function withZoneSightings(
  state: SpatialRuleEffectStateDto,
  actorIds: readonly string[]
): SpatialRuleEffectStateDto {
  const { concealment } = state
  const added = zoneSightingCandidates(state, actorIds)
  if (!concealment || !added.length) return state
  const sightings = [
    ...concealment.sightings,
    ...[...new Set(added)].map((actorId) => ({ actorId, status: 'PROMPTED' as const }))
  ].sort(
    (left, right) => Number(left.actorId > right.actorId) - Number(left.actorId < right.actorId)
  )
  return { ...state, concealment: { ...concealment, sightings } }
}

/** A concealed zone's state with one Character's sighting set to `status`; null when it has none. */
export function withZoneSightingStatus(
  state: SpatialRuleEffectStateDto,
  actorId: string,
  status: 'PROMPTED' | 'DISMISSED'
): SpatialRuleEffectStateDto | null {
  const { concealment } = state
  if (!concealment?.sightings.some((sighting) => sighting.actorId === actorId)) return null
  return {
    ...state,
    concealment: {
      ...concealment,
      sightings: concealment.sightings.map((sighting) =>
        sighting.actorId === actorId ? { actorId, status } : sighting
      )
    }
  }
}
