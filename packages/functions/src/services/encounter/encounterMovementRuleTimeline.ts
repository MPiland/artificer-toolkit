import type {
  ReactionReachCandidate,
  SpatialMovementCandidate
} from '@artificer-toolkit/shared/vtt'

export type EncounterMovementRuleTimelineEntry =
  | {
      kind: 'SPATIAL'
      pathDistance: number
      candidate: SpatialMovementCandidate
    }
  | {
      kind: 'REACTION'
      pathDistance: number
      candidate: ReactionReachCandidate
    }

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * One deterministic movement timeline. Spatial contacts precede reaction
 * contacts at an identical path distance, as required by the Encounter
 * continuation contract.
 */
export function createEncounterMovementRuleTimeline(input: {
  spatialCandidates: readonly SpatialMovementCandidate[]
  reactionCandidates: readonly ReactionReachCandidate[]
}): readonly EncounterMovementRuleTimelineEntry[] {
  return [
    ...input.spatialCandidates.map(
      (candidate): EncounterMovementRuleTimelineEntry => ({
        kind: 'SPATIAL',
        pathDistance: candidate.pathDistance,
        candidate
      })
    ),
    ...input.reactionCandidates.map(
      (candidate): EncounterMovementRuleTimelineEntry => ({
        kind: 'REACTION',
        pathDistance: candidate.pathDistance,
        candidate
      })
    )
  ].sort((left, right) => {
    if (left.pathDistance !== right.pathDistance) return left.pathDistance - right.pathDistance
    if (left.kind !== right.kind) return left.kind === 'SPATIAL' ? -1 : 1
    if (left.kind === 'SPATIAL' && right.kind === 'SPATIAL') {
      return (
        compareText(left.candidate.effectId, right.candidate.effectId) ||
        compareText(left.candidate.targetActorId, right.candidate.targetActorId) ||
        compareText(left.candidate.trigger, right.candidate.trigger)
      )
    }
    if (left.kind === 'REACTION' && right.kind === 'REACTION') {
      return (
        compareText(left.candidate.sourceId, right.candidate.sourceId) ||
        compareText(left.candidate.reactorTokenId, right.candidate.reactorTokenId) ||
        compareText(left.candidate.stage, right.candidate.stage)
      )
    }
    return 0
  })
}
