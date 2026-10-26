import type { SpatialRuleEffectStateDto, ZoneDcDto } from '@artificer-toolkit/schema/shared/spatial'

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
  return {
    schemaVersion: state.schemaVersion,
    revealed: state.revealed,
    ...(input.spotDc ? { concealment: { spotDc: input.spotDc, knownByActorIds } } : {}),
    ...(input.disarmDc ? { disarmDc: input.disarmDc } : {})
  }
}
