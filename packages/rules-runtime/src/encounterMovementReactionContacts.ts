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

import type { MovementReactionEligibilitySource } from './movementReactionEligibilityService.js'

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

function movementReactionContactSourceId(input: {
  actionId: string
  reactorActorId: string
  reactorTokenId: string
}): string {
  return checksumRuleDocument({ schemaVersion: 1, ...input })
}

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
  }).flatMap((candidate) => {
    const source = sourceByContactId.get(candidate.sourceId)
    return source ? [{ candidate, contactSourceId: candidate.sourceId, source }] : []
  })
}
