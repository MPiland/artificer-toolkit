/**
 * The actor whose roll a pending spatial contact waits on: the contacted creature for its save,
 * then the zone's source for the damage dice that save's failure rolls (ADR 0034 decision 3).
 * A zone with no source actor falls back to the contacted creature, whom the GM also controls.
 */
export function spatialPendingRollerActorId(pending: {
  candidate: { sourceActorId: string | null; targetActorId: string }
  diceStage: unknown
}): string {
  return pending.diceStage
    ? (pending.candidate.sourceActorId ?? pending.candidate.targetActorId)
    : pending.candidate.targetActorId
}
