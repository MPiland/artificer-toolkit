import type {
  ReactionReachCandidate,
  SpatialMovementCandidate
} from '@artificer-toolkit/shared/vtt'

import type { EncounterMovementPassageContact } from './encounterMovementPassageContacts.js'

export type EncounterMovementRuleTimelineEntry =
  | {
      kind: 'PASSAGE'
      pathDistance: number
      candidate: EncounterMovementPassageContact
    }
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
  passageCandidate?: EncounterMovementPassageContact | null
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
    ),
    ...(input.passageCandidate
      ? [
          {
            kind: 'PASSAGE' as const,
            pathDistance: input.passageCandidate.pathDistance,
            candidate: input.passageCandidate
          }
        ]
      : [])
  ].sort((left, right) => {
    if (left.pathDistance !== right.pathDistance) return left.pathDistance - right.pathDistance
    const kindOrder = { SPATIAL: 0, PASSAGE: 1, REACTION: 2 } as const
    if (left.kind !== right.kind) return kindOrder[left.kind] - kindOrder[right.kind]
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
    if (left.kind === 'PASSAGE' && right.kind === 'PASSAGE') {
      return (
        compareText(left.candidate.blockerActorId, right.candidate.blockerActorId) ||
        compareText(left.candidate.blockerTokenId, right.candidate.blockerTokenId)
      )
    }
    return 0
  })
}
