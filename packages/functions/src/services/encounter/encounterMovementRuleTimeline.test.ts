import { describe, expect, it } from 'vitest'

import type {
  ReactionReachCandidate,
  SpatialMovementCandidate
} from '@artificer-toolkit/shared/vtt'

import { createEncounterMovementRuleTimeline } from './encounterMovementRuleTimeline.js'

function spatial(
  effectId: string,
  pathDistance: number,
  trigger: SpatialMovementCandidate['trigger'] = 'ENTER'
): SpatialMovementCandidate {
  return {
    contact: { x: pathDistance, y: 0 },
    effectId,
    pathDistance,
    sourceActorId: null,
    sourceMoved: false,
    targetActorId: '00000000-0000-4000-8000-000000000101',
    trigger
  }
}

function reaction(sourceId: string, pathDistance: number): ReactionReachCandidate {
  return {
    contact: { x: pathDistance, y: 0 },
    movingActorId: '00000000-0000-4000-8000-000000000102',
    pathDistance,
    reactorActorId: '00000000-0000-4000-8000-000000000103',
    reactorTokenId: '00000000-0000-4000-8000-000000000104',
    sourceId,
    stage: 'BEFORE_LEAVE_REACH'
  }
}

describe('Encounter movement rule timeline', () => {
  it('orders by path distance and resolves the complete spatial group before reactions', () => {
    const result = createEncounterMovementRuleTimeline({
      spatialCandidates: [
        spatial('effect-b', 10),
        spatial('effect-a', 10),
        spatial('effect-z', 20)
      ],
      reactionCandidates: [
        reaction('reaction-b', 10),
        reaction('reaction-a', 10),
        reaction('reaction-z', 5)
      ],
      passageCandidate: {
        blockerActorId: '00000000-0000-4000-8000-000000000105',
        blockerTokenId: '00000000-0000-4000-8000-000000000106',
        contact: { x: 10, y: 0 },
        pathDistance: 10
      }
    })

    expect(
      result.map((entry) =>
        entry.kind === 'SPATIAL'
          ? `${entry.pathDistance}:SPATIAL:${entry.candidate.effectId}`
          : entry.kind === 'PASSAGE'
            ? `${entry.pathDistance}:PASSAGE:${entry.candidate.blockerActorId}`
            : `${entry.pathDistance}:REACTION:${entry.candidate.sourceId}`
      )
    ).toEqual([
      '5:REACTION:reaction-z',
      '10:SPATIAL:effect-a',
      '10:SPATIAL:effect-b',
      '10:PASSAGE:00000000-0000-4000-8000-000000000105',
      '10:REACTION:reaction-a',
      '10:REACTION:reaction-b',
      '20:SPATIAL:effect-z'
    ])
  })
})
