import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'

import type { CharacterEndedEffectReleaseApplication } from './characterRuleActionSystemAdapter.js'
import { prepareNativeIncomingDamageGrantTriggers } from './encounterActionEffects.js'
import type { FrozenMovementReactionRemainder } from './encounterSpatialMovementRuleService.js'
import { type TargetState, targetTemporaryHitPoints } from './encounterCharacterMechanicsBatch.js'
import { joinDamagedDiscoveries } from './encounterDamageSaveChain.js'
import { targetEndedEffects, type EncounterGrantTrigger } from './encounterEndedEffectRelease.js'
import { temporaryHitPointsAfterRelease } from '@artificer-toolkit/schema/shared/temporaryHitPoints'

/** What a spatial execution carries of the damage it dealt and the zone's source that dealt it. */
type DamagingSpatialExecution = Pick<
  FrozenMovementReactionRemainder['completedSpatialExecutions'][number],
  'applications'
> & { candidate: { candidate: { sourceActorId: string | null } } }

/**
 * What the damage a creature takes from zones ends on it in one raise (a melee retaliation; a turn
 * zone raises once per execution through `spatialDamageEndsPerExecution`):
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
  /** What the holder's one raise found owing a repeat save, less the effects it ended. */
  repeatSaveEffects: ActiveRuleEffectRecord[]
} {
  // One raise for the holder however many contacts damaged it, with one hit per contact's source.
  const { endedEffects, releases, grants, repeatSaveEffects } = targetEndedEffects({
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
  return { endedEffects, releases, grants, repeatSaveEffects }
}

/**
 * What a turn boundary's zones' damage ends on a creature they caught (D220): each zone execution is
 * its own `DAMAGED(AFTER)` raise, in execution order, over the effects the earlier raises left, so
 * overlapping zones each owe what their damage meets. A grant an earlier raise gave is not owed
 * again, and the discovery is the raises' joined in order, less every effect a raise ended. The
 * releases follow the zones' applications in the creature's one mechanics batch.
 */
export function spatialDamageEndsPerExecution(
  input: Parameters<typeof spatialDamageEnds>[0]
): ReturnType<typeof spatialDamageEnds> {
  const endedEffects: ActiveRuleEffectRecord[] = []
  const releases: CharacterEndedEffectReleaseApplication[] = []
  const grants: ReturnType<typeof spatialDamageEnds>['grants'] = []
  const raises: (readonly [string, ActiveRuleEffectRecord[]])[] = []
  for (const execution of input.executions) {
    const ends = spatialDamageEnds({
      ...input,
      held: input.held.filter(({ id }) => !endedEffects.some((ended) => ended.id === id)),
      executions: [execution]
    })
    endedEffects.push(...ends.endedEffects)
    releases.push(...ends.releases)
    grants.push(...ends.grants.filter(({ id }) => !grants.some((given) => given.id === id)))
    raises.push([input.holderActorId, ends.repeatSaveEffects])
  }
  return {
    endedEffects,
    releases,
    grants,
    repeatSaveEffects: (joinDamagedDiscoveries(raises).get(input.holderActorId) ?? []).filter(
      ({ id }) => !endedEffects.some((ended) => ended.id === id)
    )
  }
}

/**
 * What one contact of a move does to the creature it damaged (D220): its own `DAMAGED(AFTER)` raise
 * ends the held effects whose `DAMAGE_TAKEN` end trigger the zone's damage meets (a `DAMAGE_END` step
 * each, which releases what they gave, their temporary hit points and the conditions only they held),
 * gives the grants the creature's passive damage triggers owe it (a `DAMAGE_GRANT` step each), and
 * finds the effects owing a repeat save. They settle right after the contact, before its saves, so
 * a later contact sees them. An effect the move itself placed (a zone's entry grant or held
 * condition, or a grant an earlier contact gave) never ends on the move's own damage, and the move
 * gives each grant once: a grant its creature already holds is not owed again. Planning and
 * persisting both call this over the holder's current actor and effects, with the move's own command.
 */
export function movementContactDamageEnds(input: {
  holder: EncounterRunActorState
  /** Every effect the holder carries at this point of the move's settlement. */
  held: readonly ActiveRuleEffectRecord[]
  /** The contact, which damaged the holder. */
  execution: DamagingSpatialExecution & { candidate: { candidate: { targetActorId: string } } }
  encounter: { id: string; currentActorId: string | null }
  /** The move's occurrence. */
  occurrenceId: string
  /** The command that settles the move, which roots the grants it gives. */
  commandId: string
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
}) {
  const { holder } = input
  if (input.execution.candidate.candidate.targetActorId !== holder.id)
    throw new Error('Movement damage holder is not the contact target.')
  const held = input.held.filter(
    ({ definition }) => definition.origin.sourceOccurrenceId !== input.occurrenceId
  )
  const ends = spatialDamageEnds({
    holderActorId: holder.id,
    held,
    executions: [input.execution],
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
  return {
    ...ends,
    grants: ends.grants.filter(({ id }) => !input.held.some((effect) => effect.id === id))
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
