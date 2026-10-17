/**
 * Whether a paused spatial contact waits on its zone's damage dice rather than a save: the dice a
 * resolved save's failure rolls, or those of an outcome with no save (D144).
 */
export function awaitsSpatialDamageDice(pending: { d20Policy: unknown; diceStage: unknown }) {
  return Boolean(pending.diceStage) || !pending.d20Policy
}

/**
 * The actor whose roll a pending spatial contact waits on: the contacted creature for its save,
 * then the zone's source for its damage dice (ADR 0034 decision 3).
 * A zone with no source actor falls back to the contacted creature, whom the GM also controls.
 */
export function spatialPendingRollerActorId(pending: {
  candidate: { sourceActorId: string | null; targetActorId: string }
  d20Policy: unknown
  diceStage: unknown
}): string {
  return awaitsSpatialDamageDice(pending)
    ? (pending.candidate.sourceActorId ?? pending.candidate.targetActorId)
    : pending.candidate.targetActorId
}
