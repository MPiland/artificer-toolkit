import type { CompiledActionZonePlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { LiveSessionPlacedSpatialEffect } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { spatialRuleEffectPlacementDtoSchema } from '@artificer-toolkit/schema/shared/spatial'
import {
  isDirectedAreaShape,
  pointCubeOutline,
  type ScenePoint,
  type SpatialAreaShape
} from '@artificer-toolkit/shared/vtt'

import { compileEffectGraph } from './encounterActionEffectPlans.js'

/**
 * The spatial effect an area action leaves at the point its user chose: the compiled zone fixed to
 * the Scene at that point. A creature entering it runs the zone's entry; a lingering grant is the
 * zone's modifier-grant template, so it ends on the events the zone authors.
 */
export function planEncounterPlacedZone(input: {
  zone: CompiledActionZonePlacement
  id: string
  encounterId: string
  occurrenceId: string
  rootCommandId: string
  sourceActorId: string
  point: ScenePoint
  area: SpatialAreaShape
}): LiveSessionPlacedSpatialEffect {
  const { zone, point, area } = input
  if (isDirectedAreaShape(area)) throw new Error('A placed zone needs a point-origin area.')
  const { entry, lingeringEffect } = zone
  const grant = lingeringEffect?.modifierGrantContribution ?? null
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: grant ? 2 : 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: input.occurrenceId,
      rootCommandId: input.rootCommandId,
      sourceActorId: input.sourceActorId
    },
    authoredEffectId: entry.authoredEffectId,
    compiledEntryId: entry.compiledEntryId,
    frozenGraphNodeId: entry.frozenGraphNodeId,
    frozenGraph: compileEffectGraph(entry.frozenGraph, entry.capabilityContractVersion),
    adapterFacts: entry.adapterFacts,
    perceptionContributions: entry.perceptionContributions,
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [],
      endOnEvents: grant?.endOnEvents ?? [],
      lifetimeScope: 'ENCOUNTER',
      expiration: { kind: 'INDEFINITE' }
    },
    ...(grant
      ? {
          stateContributions: [
            {
              kind: 'MODIFIER_GRANT' as const,
              applyGrantOutcomeId: grant.applyGrantOutcomeId,
              modifiers: grant.modifiers,
              senses: grant.senses,
              sourceLabel: zone.label,
              sourceHidden: false
            }
          ]
        }
      : {})
  })
  return {
    id: input.id,
    definition,
    lifecycle: { schemaVersion: 1, remainingTicks: null },
    placement: spatialRuleEffectPlacementDtoSchema.parse({
      schemaVersion: 1,
      anchorKind: 'FIXED',
      sourceTokenId: null,
      geometry: {
        frame: 'SCENE_ABSOLUTE',
        shape:
          area.kind === 'CUBE'
            ? { kind: 'POLYGON', points: pointCubeOutline(point, area.edgeLength) }
            : { kind: 'CIRCLE', center: point, radius: area.radius }
      },
      triggerModes: zone.triggerModes,
      movementKinds: zone.movementKinds,
      activation: zone.activation,
      visibility: zone.visibility,
      revealOnTrigger: false,
      label: zone.label,
      bypassAtHalfSpeed: zone.bypassAtHalfSpeed
    }),
    spatialState: { schemaVersion: 1, revealed: true }
  }
}
