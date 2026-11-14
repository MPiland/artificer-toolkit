import {
  collectReactionReachCandidates,
  lengthMeasurementInSceneUnits,
  type SceneLength,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'

type ReachInput = Parameters<typeof collectReactionReachCandidates>[0]

// Pure fixture helper: the real-backend drivers import it, so it must not reach convex-test.
/**
 * Where the product's reach geometry says a move first triggers the reactor's authored Reaction. The
 * reach function is the product's own (`@artificer-toolkit/shared/vtt`); a test compares what the
 * room checkpoints or offers against it, so the contact's exact point stays proved after the offer
 * stopped carrying its path distance.
 */
export function expectedReactionContact(
  input: Pick<ReachInput, 'actorIdByTokenId' | 'grid' | 'movingTokenId' | 'path' | 'tokens'> & {
    movementKind?: ReachInput['movementKind']
    reach: SceneLength
    reactorTokenId: string
    stage: ReachInput['sources'][number]['stage']
  }
): ScenePoint {
  const [first] = collectReactionReachCandidates({
    actorIdByTokenId: input.actorIdByTokenId,
    grid: input.grid,
    movementKind: input.movementKind ?? 'VOLUNTARY',
    movingTokenId: input.movingTokenId,
    path: input.path,
    sources: [
      {
        reach: lengthMeasurementInSceneUnits(input.reach, input.grid),
        reactorTokenId: input.reactorTokenId,
        sourceId: input.reactorTokenId,
        stage: input.stage
      }
    ],
    tokens: input.tokens
  })
  if (!first) throw new Error('The reach function found no contact on the path.')
  return first.contact
}
