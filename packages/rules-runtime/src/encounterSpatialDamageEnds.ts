import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'

import type { CharacterEndedEffectReleaseApplication } from './characterRuleActionSystemAdapter.js'
import type { FrozenMovementReactionRemainder } from './encounterSpatialMovementRuleService.js'
import { type TargetState, targetTemporaryHitPoints } from './encounterCharacterMechanicsBatch.js'
import { targetEndedEffects, type EncounterGrantTrigger } from './encounterEndedEffectRelease.js'
import { temporaryHitPointsAfterRelease } from '@artificer-toolkit/schema/shared/temporaryHitPoints'
import { endsOnLeavingZone } from './encounterSpatialHeldCondition.js'

type TerminalMovementOutcome = Extract<SceneSpatialPreparation['outcome'], { kind: 'TERMINAL' }>

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
  // One raise for the holder however many contacts damaged it, with one hit per contact's source.
  const { endedEffects, releases, grants } = targetEndedEffects({
    holderActorId: input.holderActorId,
    held: input.held,
    attack: null,
    testEvidence: [],
    turnActorId: input.turnActorId,
    applications: [],
    damagerActorId: null,
    damageBySource: input.executions.map((execution) => ({
      damagerActorId: execution.candidate.candidate.sourceActorId,
      applications: execution.applications.map((application) => ({
        ...application,
        targetActorId: input.holderActorId
      }))
    })),
    dispositions: input.dispositions,
    ...(input.grantTriggers ? { grantTriggers: input.grantTriggers } : {})
  })
  return { endedEffects, releases, grants }
}

/**
 * The effects a move's zone damage ends on one creature it damaged. They end once the move's last
 * contact has settled (a `DAMAGE_END` step each), so the holder has one `DAMAGED(AFTER)` raise for
 * the whole move however many contacts it crossed. An effect the move itself placed (a zone's entry
 * grant or held condition) never ends on the move's own damage. Planning and persisting both call
 * this over the holder's current effects.
 */
export function movementDamageEndedEffects(input: {
  holderActorId: string
  /** Every effect the holder carries when the move ends. */
  held: readonly ActiveRuleEffectRecord[]
  /** Every spatial execution of the move, whichever creature it reached. */
  executions: readonly (DamagingSpatialExecution & {
    candidate: { candidate: { targetActorId: string } }
  })[]
  /** The move's occurrence. */
  occurrenceId: string
  turnActorId: string | null
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
}): ActiveRuleEffectRecord[] {
  return spatialDamageEnds({
    holderActorId: input.holderActorId,
    held: input.held.filter(
      ({ definition }) => definition.origin.sourceOccurrenceId !== input.occurrenceId
    ),
    executions: input.executions.filter(
      ({ candidate }) => candidate.candidate.targetActorId === input.holderActorId
    ),
    turnActorId: input.turnActorId,
    dispositions: input.dispositions
  }).endedEffects
}

/**
 * The `damageEnds` a finished move's outcome carries: what its zone damage ends on each creature it
 * damaged, from the effects those creatures hold as the move ends. An effect the move already
 * releases (it left the zone holding it, or it ends on moving) is not listed again. Empty when
 * nothing ends.
 */
export function terminalMovementDamageEnds(input: {
  result: TerminalMovementOutcome['result']
  targets: ReadonlyMap<
    string,
    {
      actor: { disposition: EncounterActorDispositionDto }
      activeEffects: ActiveRuleEffectRecord[]
    }
  >
  occurrenceId: string
  turnActorId: string | null
  released?: Pick<TerminalMovementOutcome, 'areaDepartures' | 'moveEnds'>
}): Pick<TerminalMovementOutcome, 'damageEnds'> {
  const { result, targets } = input
  if (result.status !== 'BATCH_COMPLETE') return {}
  const dispositions = new Map(
    [...targets].map(([actorId, { actor }]) => [actorId, actor.disposition])
  )
  const isReleased = (holderActorId: string, effect: ActiveRuleEffectRecord) =>
    (input.released?.moveEnds ?? []).some(({ effectId }) => effectId === effect.id) ||
    (input.released?.areaDepartures ?? []).some(
      (departure) =>
        departure.holderActorId === holderActorId &&
        endsOnLeavingZone(effect, departure.zoneEffectId)
    )
  const damageEnds = [
    ...new Set(result.executions.map(({ candidate }) => candidate.candidate.targetActorId))
  ].flatMap((holderActorId) =>
    movementDamageEndedEffects({
      holderActorId,
      held: (targets.get(holderActorId)?.activeEffects ?? []).filter(
        (effect) => !isReleased(holderActorId, effect)
      ),
      executions: result.executions,
      occurrenceId: input.occurrenceId,
      turnActorId: input.turnActorId,
      dispositions
    }).map(({ id }) => ({ effectId: id, holderActorId }))
  )
  return damageEnds.length ? { damageEnds } : {}
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
