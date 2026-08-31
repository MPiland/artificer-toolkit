import type { RangeDto } from '@artificer-toolkit/schema/shared/range'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  collectReactionReachCandidates,
  lengthMeasurementInSceneUnits,
  type ReactionReachCandidate,
  type SceneGrid,
  type ScenePoint,
  type SceneToken,
  type SpatialMovementKind
} from '@artificer-toolkit/shared/vtt'

import type { MovementReactionEligibilitySource } from '../rules/movementReactionEligibilityService.js'

export interface EncounterMovementReactionContactSource {
  reactorActorId: string
  reactorTokenId: string
  range: RangeDto
  source: MovementReactionEligibilitySource
}

export interface EncounterMovementReactionContact<
  TSource extends EncounterMovementReactionContactSource = EncounterMovementReactionContactSource
> {
  candidate: ReactionReachCandidate
  contactSourceId: string
  source: TSource
}

export function movementReactionContactSourceId(input: {
  actionId: string
  reactorActorId: string
  reactorTokenId: string
}): string {
  return checksumRuleDocument({ schemaVersion: 1, ...input })
}

/**
 * Converts exact compiled action ranges into deterministic full-footprint
 * contacts. Non-distance reaction actions remain unavailable to automatic
 * reach discovery; the application never guesses a distance from a label.
 */
export function collectEncounterMovementReactionContacts<
  TSource extends EncounterMovementReactionContactSource
>(input: {
  grid: SceneGrid
  movementKind: SpatialMovementKind
  movingTokenId: string
  path: readonly ScenePoint[]
  actorIdByTokenId: ReadonlyMap<string, string>
  tokens: readonly Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>[]
  sources: readonly TSource[]
}): readonly EncounterMovementReactionContact<TSource>[] {
  const collectedSources = input.sources.flatMap((source) => {
    const reactor = input.tokens.find((token) => token.id === source.reactorTokenId)
    if (!reactor || input.actorIdByTokenId.get(reactor.id) !== source.reactorActorId) {
      throw new Error('Movement reaction source does not match its authoritative reactor token.')
    }
    if (source.range.rangeKind !== 'DISTANCE') return []
    const reach = lengthMeasurementInSceneUnits(
      { amount: source.range.amount, unit: source.range.unit },
      input.grid
    )
    if (reach === null) return []
    const contactSourceId = movementReactionContactSourceId({
      actionId: source.source.capability.actionId,
      reactorActorId: source.reactorActorId,
      reactorTokenId: source.reactorTokenId
    })
    return [
      {
        contactSourceId,
        reach,
        reactorTokenId: source.reactorTokenId,
        sourceId: contactSourceId,
        stage: source.source.binding.stage
      }
    ]
  })
  const sourceByContactId = new Map<string, TSource>(
    input.sources.map((source) => {
      const contactSourceId = movementReactionContactSourceId({
        actionId: source.source.capability.actionId,
        reactorActorId: source.reactorActorId,
        reactorTokenId: source.reactorTokenId
      })
      return [contactSourceId, source] as const
    })
  )
  return collectReactionReachCandidates({
    actorIdByTokenId: input.actorIdByTokenId,
    grid: input.grid,
    movementKind: input.movementKind,
    movingTokenId: input.movingTokenId,
    path: input.path,
    sources: collectedSources,
    tokens: input.tokens
  }).map((candidate) => {
    const source = sourceByContactId.get(candidate.sourceId)
    if (!source) throw new Error('Movement reaction contact has no exact capability source.')
    return { candidate, contactSourceId: candidate.sourceId, source }
  })
}
