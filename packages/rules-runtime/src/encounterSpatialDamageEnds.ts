import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'

import type { CharacterEndedEffectReleaseApplication } from './characterRuleActionSystemAdapter.js'
import type { FrozenMovementReactionRemainder } from './encounterSpatialMovementRuleService.js'
import { type TargetState, targetTemporaryHitPoints } from './encounterCharacterMechanicsBatch.js'
import {
  endedEffectReleases,
  targetEndedEffects,
  type EncounterGrantTrigger
} from './encounterEndedEffectRelease.js'
import { temporaryHitPointsAfterRelease } from '@artificer-toolkit/schema/shared/temporaryHitPoints'

/** What a spatial execution carries of the damage it dealt and the zone's source that dealt it. */
type DamagingSpatialExecution = Pick<
  FrozenMovementReactionRemainder['completedSpatialExecutions'][number],
  'applications'
> & { candidate: { candidate: { sourceActorId: string | null } } }

/**
 * What the damage a creature takes from zones ends on it (the turn zone, a melee retaliation):
 * the held effects whose `DAMAGE_TAKEN` end trigger a zone's damage meets (the zone's source is the
 * damager), and the conditions only they held. A mechanics batch applies the releases after the
 * zones' own applications, in the same transaction as the effects' deletion, so planning and
 * persisting both call this over the same held effects.
 */
export function spatialDamageEnds(input: {
  holderActorId: string
  /** Every effect the holder carries before the zones' damage. */
  held: readonly ActiveRuleEffectRecord[]
  executions: readonly DamagingSpatialExecution[]
  /** The actor whose turn it is. */
  turnActorId: string | null
  /** Every Encounter actor's disposition, to tell a zone source's side from the rest. */
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
  /** The grants the holder's passive features give when a zone's damage meets them; none when omitted. */
  grantTriggers?: readonly EncounterGrantTrigger[]
}): {
  endedEffects: ActiveRuleEffectRecord[]
  releases: CharacterEndedEffectReleaseApplication[]
  grants: ReturnType<typeof targetEndedEffects>['grants']
} {
  const ended = new Map<string, ActiveRuleEffectRecord>()
  const grants = new Map<string, ReturnType<typeof targetEndedEffects>['grants'][number]>()
  for (const execution of input.executions) {
    const endedBy = targetEndedEffects({
      holderActorId: input.holderActorId,
      held: input.held,
      attack: null,
      testEvidence: [],
      turnActorId: input.turnActorId,
      applications: execution.applications.map((application) => ({
        ...application,
        targetActorId: input.holderActorId
      })),
      damagerActorId: execution.candidate.candidate.sourceActorId,
      dispositions: input.dispositions,
      ...(input.grantTriggers ? { grantTriggers: input.grantTriggers } : {})
    })
    for (const effect of endedBy.endedEffects) ended.set(effect.id, effect)
    for (const grant of endedBy.grants) grants.set(grant.id, grant)
  }
  const endedEffects = input.held.filter(({ id }) => ended.has(id))
  return {
    endedEffects,
    releases: endedEffectReleases({
      holderActorId: input.holderActorId,
      held: input.held,
      ended: endedEffects
    }),
    grants: [...grants.values()]
  }
}

/**
 * The target state once its ended effects' releases apply to the state the zones left it in: the
 * conditions removed and the temporary hit points that left with their source effect.
 */
export function targetStateAfterEndedEffects<
  TState extends Pick<TargetState, 'temporaryHitPoints' | 'temporaryHitPointsSourceEffectId'> & {
    conditionIds: readonly string[]
  }
>(state: TState, releases: readonly CharacterEndedEffectReleaseApplication[]): TState {
  const released = new Set(
    releases.flatMap((release) =>
      release.kind === 'CONDITION_REMOVE' ? [release.conditionId] : []
    )
  )
  const pool = releases.reduce(
    (current, release) =>
      release.kind === 'TEMPORARY_HIT_POINTS_RELEASE'
        ? temporaryHitPointsAfterRelease(current, release.sourceActiveEffectId)
        : current,
    targetTemporaryHitPoints(state)
  )
  const next = {
    ...state,
    temporaryHitPoints: pool.amount,
    conditionIds: state.conditionIds.filter((conditionId) => !released.has(conditionId))
  }
  if (pool.sourceEffectId === null) delete next.temporaryHitPointsSourceEffectId
  else next.temporaryHitPointsSourceEffectId = pool.sourceEffectId
  return next
}
