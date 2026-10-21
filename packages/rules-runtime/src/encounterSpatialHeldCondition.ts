import { v5 as uuidv5 } from 'uuid'

import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'

import { conditionBaselinePresent } from './encounterActionEffectPlans.js'
import { endSubscriptions } from './events/effectHooks.js'

const SPATIAL_HELD_CONDITION_NAMESPACE = '8e3c1f52-6a0d-4b7e-a9c4-2d5f7b1e0c93'

/**
 * The effect through which a zone holds the condition a creature gained by failing its save
 * (D146). It owns the condition for the zone: it carries the zone's maintenance, so it ends with
 * the zone's Concentration, ends when the creature leaves the area if the zone says so, and offers
 * the zone's escape. The zone's frozen graph is only its provenance. Null when the zone holds no
 * condition, the save did not apply it (the creature resisted or is immune), or the zone already
 * holds it on the creature.
 */
export function planSpatialHeldCondition(input: {
  zone: Pick<EncounterSpatialRuleEffectRecord, 'id' | 'definition' | 'placement'>
  holder: { activeEffects: readonly ActiveRuleEffectRecord[]; conditionIds: readonly string[] }
  applications: readonly { kind: string; conditionId?: string }[]
  encounterId: string
  occurrenceId: string
  sourceCommandId: string
  targetActorId: string
}) {
  const { zone, holder } = input
  const held = zone.placement.heldCondition
  if (
    !held ||
    zone.definition.origin.kind !== 'ENCOUNTER' ||
    !input.applications.some(
      (application) =>
        application.kind === 'CONDITION_APPLY' && application.conditionId === held.conditionId
    ) ||
    holder.activeEffects.some(({ definition }) =>
      definition.stateContributions.some(
        (contribution) =>
          contribution.kind === 'CONDITION_OWNERSHIP' &&
          contribution.heldBySpatialEffectId === zone.id
      )
    )
  )
    return null
  return {
    id: uuidv5(
      `${input.occurrenceId}:${input.sourceCommandId}:${zone.id}:${input.targetActorId}`,
      SPATIAL_HELD_CONDITION_NAMESPACE
    ),
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      schemaVersion: 2,
      origin: {
        kind: 'ENCOUNTER',
        sourceAggregateId: input.encounterId,
        sourceOccurrenceId: input.occurrenceId,
        rootCommandId: input.sourceCommandId,
        sourceActorId: zone.definition.origin.sourceActorId
      },
      authoredEffectId: zone.definition.authoredEffectId,
      compiledEntryId: zone.definition.compiledEntryId,
      frozenGraphNodeId: zone.definition.frozenGraphNodeId,
      frozenGraph: zone.definition.frozenGraph,
      adapterFacts: {},
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: held.endsAtEndOfHolderTurn ? 'END_OF_TURN' : 'NONE',
        consumeOnFirstEvents: [],
        endOnEvents: held.endsOnLeavingArea ? ['ON_LEAVING_AREA'] : [],
        endOnTriggers: [],
        endOnConditionIds: [],
        holderEnd: null,
        lifetimeScope: 'ENCOUNTER',
        expiration: held.endsAtEndOfHolderTurn
          ? { kind: 'TICKS', initialRemaining: 1, decrementStage: 'END_OF_TURN', anchor: 'HOLDER' }
          : { kind: 'INDEFINITE' }
      },
      stateContributions: [
        {
          kind: 'CONDITION_OWNERSHIP',
          conditionId: held.conditionId,
          baselinePresent: conditionBaselinePresent(holder, held.conditionId),
          ...(held.recordsSource ? { sourceActorId: zone.definition.origin.sourceActorId } : {}),
          heldBySpatialEffectId: zone.id
        },
        ...(held.escape
          ? [
              {
                kind: 'CONDITION_ESCAPE',
                label: zone.placement.label,
                activation: held.escape.activation,
                checks: held.escape.checks,
                dc: held.escape.dc
              }
            ]
          : [])
      ]
    }),
    lifecycle: { schemaVersion: 1 as const, remainingTicks: held.endsAtEndOfHolderTurn ? 1 : null }
  }
}

/** The zone an effect holds its condition for until the holder leaves the zone's area, or null. */
export function heldUntilLeavingZoneId({ definition }: Pick<ActiveRuleEffectRecord, 'definition'>) {
  if (!endSubscriptions({ definition }).some((subscription) => subscription.event === 'AREA_LEFT'))
    return null
  for (const contribution of definition.stateContributions)
    if (contribution.kind === 'CONDITION_OWNERSHIP' && contribution.heldBySpatialEffectId)
      return contribution.heldBySpatialEffectId
  return null
}

/** Each creature's zones holding a condition on it until it leaves their area (D146). */
export function leavingAreaHolds(
  targets: Iterable<{
    actor: { id: string }
    activeEffects: readonly Pick<ActiveRuleEffectRecord, 'definition'>[]
  }>
) {
  return [...targets].flatMap(({ actor, activeEffects }) =>
    activeEffects.flatMap((effect) => {
      const zoneEffectId = heldUntilLeavingZoneId(effect)
      return zoneEffectId ? [{ actorId: actor.id, zoneEffectId }] : []
    })
  )
}
