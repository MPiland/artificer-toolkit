import type { FrozenMovementReactionRemainder } from './encounterSpatialMovementRuleService.js'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { MovementTarget } from './encounterMovementTargets.js'

type SpatialCurrentnessTarget = Pick<
  MovementTarget,
  'actor' | 'state' | 'effectiveMaximumHitPoints' | 'effectiveScalarValues' | 'characterCurrentness'
>

export function checksumSpatialCurrentness(input: {
  encounter: Pick<EncounterRunState, 'id' | 'version'>
  candidates: readonly unknown[]
}): string {
  return checksumRuleDocument({
    schemaVersion: 1,
    encounter: { id: input.encounter.id, version: input.encounter.version },
    candidates: input.candidates
  })
}

/** Projects only future contacts through an already-verified plan in this mutation. */
export function projectSpatialMovementCandidates(input: {
  candidates: FrozenMovementReactionRemainder['remainingSpatialCandidates']
  beforeTargets: ReadonlyMap<string, SpatialCurrentnessTarget>
  afterTargets: ReadonlyMap<string, SpatialCurrentnessTarget>
}): FrozenMovementReactionRemainder['remainingSpatialCandidates'] {
  return input.candidates.map((candidate) => {
    const actorId = candidate.candidate.targetActorId
    const before = input.beforeTargets.get(actorId)
    const after = input.afterTargets.get(actorId)
    if (
      !before ||
      !after ||
      before.actor.id !== actorId ||
      after.actor.id !== actorId ||
      before.actor.kind !== after.actor.kind ||
      before.actor.encounterId !== after.actor.encounterId ||
      before.actor.systemId !== after.actor.systemId ||
      before.actor.sourceId !== after.actor.sourceId
    )
      throw new Error('Projected spatial contact owner changed.')
    const targetStateChecksum = checksumRuleDocument({
      targetActorId: actorId,
      currentHitPoints: after.state.current,
      temporaryHitPoints: after.state.temporary,
      maximumHitPoints: after.effectiveMaximumHitPoints,
      conditionIds: after.state.conditions,
      scalarValues: after.effectiveScalarValues
    })
    if (candidate.target.kind === 'CHARACTER') {
      if (
        before.actor.kind !== 'CHARACTER' ||
        after.actor.kind !== 'CHARACTER' ||
        !before.characterCurrentness ||
        !after.characterCurrentness ||
        !after.actor.sourceId ||
        after.actor.sourceRevision === null ||
        candidate.target.characterId !== before.actor.sourceId ||
        candidate.target.streamVersion !== before.actor.sourceRevision ||
        candidate.target.projectionChecksum !== before.characterCurrentness.projectionChecksum ||
        candidate.target.mechanicalContextChecksum !==
          before.characterCurrentness.mechanicalContextChecksum
      )
        throw new Error('Projected spatial Character facts are stale.')
      return {
        ...candidate,
        target: {
          kind: 'CHARACTER' as const,
          characterId: after.actor.sourceId,
          streamVersion: after.actor.sourceRevision,
          ...after.characterCurrentness,
          targetStateChecksum
        }
      }
    }
    if (before.actor.kind === 'CHARACTER')
      throw new Error('Projected spatial contact owner changed.')
    return { ...candidate, target: { ...candidate.target, targetStateChecksum } }
  })
}
