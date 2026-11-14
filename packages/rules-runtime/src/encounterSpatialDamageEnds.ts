import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'

import type { CharacterEndedEffectReleaseApplication } from './characterRuleActionSystemAdapter.js'
import { prepareNativeIncomingDamageGrantTriggers } from './encounterActionEffects.js'
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
 * What a move's zone damage does to one creature it damaged, as the turn zone's does: the effects it
 * ends (a `DAMAGE_END` step each, which releases what they gave, their temporary hit points and the
 * conditions only they held) and the grants the creature's passive damage triggers owe it (a
 * `DAMAGE_GRANT` step each). They settle once the move's last contact has, so the holder has one
 * `DAMAGED(AFTER)` raise for the whole move however many contacts it crossed. An effect the move
 * itself placed (a zone's entry grant or held condition, or a grant this damage gave) never ends on
 * the move's own damage. Planning and persisting both call this over the holder's current actor and
 * effects, with the move's own command.
 */
export function movementDamageEnds(input: {
  holder: EncounterRunActorState
  /** Every effect the holder carries at this point of the move's settlement. */
  held: readonly ActiveRuleEffectRecord[]
  /** Every spatial execution of the move, whichever creature it reached. */
  executions: readonly (DamagingSpatialExecution & {
    candidate: { candidate: { targetActorId: string } }
  })[]
  encounter: { id: string; currentActorId: string | null }
  /** The move's occurrence. */
  occurrenceId: string
  /** The command that settles the move, which roots the grants it gives. */
  commandId: string
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
}) {
  const { holder } = input
  const held = input.held.filter(
    ({ definition }) => definition.origin.sourceOccurrenceId !== input.occurrenceId
  )
  return spatialDamageEnds({
    holderActorId: holder.id,
    held,
    executions: input.executions.filter(
      ({ candidate }) => candidate.candidate.targetActorId === holder.id
    ),
    turnActorId: input.encounter.currentActorId,
    dispositions: input.dispositions,
    grantTriggers: prepareNativeIncomingDamageGrantTriggers({
      encounter: input.encounter,
      holder,
      held,
      occurrenceId: input.occurrenceId,
      commandId: input.commandId,
      ordinal: 'MOVEMENT_DAMAGE',
      activeEffectsByActorId: new Map([[holder.id, held]])
    })
  })
}

/**
 * The `damageEnds` and `damageGrants` a finished move's outcome carries: what its zone damage ends
 * on and gives each creature it damaged, from the creatures as the move ends. An effect the move
 * already releases (it left the zone holding it, or it ends on moving) is not listed again. Empty
 * when the damage ends and gives nothing.
 */
export function terminalMovementDamageEnds(input: {
  result: TerminalMovementOutcome['result']
  targets: ReadonlyMap<
    string,
    { actor: EncounterRunActorState; activeEffects: ActiveRuleEffectRecord[] }
  >
  encounter: { id: string; currentActorId: string | null }
  occurrenceId: string
  commandId: string
  released?: Pick<TerminalMovementOutcome, 'areaDepartures' | 'moveEnds'>
}): Pick<TerminalMovementOutcome, 'damageEnds' | 'damageGrants'> {
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
  const ends = [
    ...new Set(result.executions.map(({ candidate }) => candidate.candidate.targetActorId))
  ].map((holderActorId) => {
    const target = targets.get(holderActorId)
    if (!target) throw new Error('Movement damage holder is unavailable.')
    const { endedEffects, grants } = movementDamageEnds({
      holder: target.actor,
      held: target.activeEffects.filter((effect) => !isReleased(holderActorId, effect)),
      executions: result.executions,
      encounter: input.encounter,
      occurrenceId: input.occurrenceId,
      commandId: input.commandId,
      dispositions
    })
    return {
      damageEnds: endedEffects.map(({ id }) => ({ effectId: id, holderActorId })),
      damageGrants: grants.map(({ id }) => ({ effectId: id, holderActorId }))
    }
  })
  const damageEnds = ends.flatMap((entry) => entry.damageEnds)
  const damageGrants = ends.flatMap((entry) => entry.damageGrants)
  return {
    ...(damageEnds.length ? { damageEnds } : {}),
    ...(damageGrants.length ? { damageGrants } : {})
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
