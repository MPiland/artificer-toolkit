import type { CompiledActionZonePlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { LiveSessionPlacedSpatialEffect } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import {
  encounterSpatialRuleEffectRecordSchema,
  type EncounterSpatialRuleEffectRecord
} from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { spatialRuleEffectPlacementDtoSchema } from '@artificer-toolkit/schema/shared/spatial'
import {
  isDirectedAreaShape,
  pointCubeOutline,
  type ScenePoint,
  type SpatialAreaShape,
  type SpatialPointAreaShape
} from '@artificer-toolkit/shared/vtt'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { compileEffectGraph } from './encounterActionEffectPlans.js'

/**
 * The spatial effect an area action leaves at the point its user chose: the compiled zone fixed to
 * the Scene at that point. A creature entering it runs the zone's entry; the grant it keeps on a
 * failure is the zone's modifier-grant template, which names the events that end it.
 *
 * A SOURCE zone is instead anchored to its user's token, so it follows the token wherever it
 * moves; its circle reaches the authored radius past the edge of the token's space. The save DC the
 * zone's entry needs is the caster's, known only at the cast, and is pinned on the zone here.
 *
 * Every placed zone is visible to all, triggers again for each mover and reacts to every kind of
 * movement: these are the System's defaults for a zone, not authored by the action.
 */
export function planEncounterPlacedZone(input: {
  zone: CompiledActionZonePlacement
  id: string
  /** The Concentration the placing cast opens or joins; null when the zone depends on none. */
  maintainedEffectStateId: string | null
  encounterId: string
  occurrenceId: string
  rootCommandId: string
  sourceActorId: string
  point: ScenePoint
  area: SpatialAreaShape
  /** The user's token; a SOURCE zone follows it. */
  sourceToken: { tokenId: string; width: number } | null
  /** The user's spell save DC as the cast resolved it. */
  saveDc: number | null
  /** Creatures the caster designated at cast; the zone never catches them. */
  unaffectedActorIds?: readonly string[]
}): LiveSessionPlacedSpatialEffect {
  const { zone, point, area } = input
  if (isDirectedAreaShape(area)) throw new Error('A placed zone needs a point-origin area.')
  const { entry, grant } = zone
  const pinnedDc = entry.castSaveDcFactKey
    ? { [entry.castSaveDcFactKey]: castSaveDc(input.saveDc) }
    : {}
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
    adapterFacts: { ...entry.adapterFacts, ...pinnedDc },
    perceptionContributions: entry.perceptionContributions,
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
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
              sourceHidden: false,
              endOnEvents: grant.endOnEvents
            }
          ]
        }
      : {})
  })
  return {
    id: input.id,
    maintainedEffectStateId: input.maintainedEffectStateId,
    definition,
    lifecycle: { schemaVersion: 1, remainingTicks: null },
    placement: spatialRuleEffectPlacementDtoSchema.parse({
      schemaVersion: 1,
      ...zoneAnchor(zone.attachment, area, point, input.sourceToken),
      triggerModes: zone.triggerModes,
      ...(zone.turnTriggers ? { turnTriggers: zone.turnTriggers } : {}),
      movementKinds: ['VOLUNTARY', 'FORCED', 'TELEPORT'],
      activation: 'REPEATABLE',
      visibility: 'PUBLIC',
      revealOnTrigger: false,
      label: zone.label,
      bypassAtHalfSpeed: zone.bypassAtHalfSpeed,
      ...(zone.maxApplicationsPerTurn !== undefined
        ? { maxApplicationsPerTurn: zone.maxApplicationsPerTurn }
        : {}),
      ...(zone.requiresFullyWithin ? { requiresFullyWithin: true } : {}),
      ...(zone.failedSaveLosesAction ? { failedSaveLosesAction: true } : {}),
      ...(input.unaffectedActorIds?.length
        ? { unaffectedActorIds: [...input.unaffectedActorIds] }
        : {})
    }),
    spatialState: { schemaVersion: 1, revealed: true }
  }
}

/**
 * A planned zone as the Scene effect store keeps it once created: its first version, with the
 * checksums the store pins. A turn plans against the zones its own commit is about to place.
 */
export function plannedSpatialEffectRecord(
  placed: LiveSessionPlacedSpatialEffect,
  scope: { encounterId: string; sceneId: string; createdOrdinal: number; createdAt: string }
): EncounterSpatialRuleEffectRecord {
  return encounterSpatialRuleEffectRecordSchema.parse({
    id: placed.id,
    encounterId: scope.encounterId,
    sceneId: scope.sceneId,
    createdOrdinal: scope.createdOrdinal,
    version: 1,
    maintainedEffectStateId: placed.maintainedEffectStateId,
    definition: placed.definition,
    definitionChecksum: checksumCanonicalJson(placed.definition),
    lifecycle: placed.lifecycle,
    lifecycleChecksum: checksumCanonicalJson(placed.lifecycle),
    placement: placed.placement,
    placementChecksum: checksumCanonicalJson(placed.placement),
    spatialState: placed.spatialState,
    spatialStateChecksum: checksumCanonicalJson(placed.spatialState),
    createdAt: scope.createdAt,
    updatedAt: scope.createdAt
  })
}

function castSaveDc(saveDc: number | null): number {
  if (saveDc === null) throw new Error('A zone that uses its user’s save DC needs it resolved.')
  return saveDc
}

/** Where a zone sits: fixed at the picked point, or on its user's token and moving with it. */
function zoneAnchor(
  attachment: CompiledActionZonePlacement['attachment'],
  area: SpatialPointAreaShape,
  point: ScenePoint,
  sourceToken: { tokenId: string; width: number } | null
) {
  if (attachment === 'PLACED_SPACE')
    return {
      anchorKind: 'FIXED' as const,
      sourceTokenId: null,
      geometry: {
        frame: 'SCENE_ABSOLUTE' as const,
        shape:
          area.kind === 'CUBE'
            ? { kind: 'POLYGON' as const, points: pointCubeOutline(point, area.edgeLength) }
            : { kind: 'CIRCLE' as const, center: point, radius: area.radius }
      }
    }
  if (area.kind !== 'RADIUS' || !sourceToken)
    throw new Error('A source zone is a circle around its user’s token.')
  return {
    anchorKind: 'TOKEN' as const,
    sourceTokenId: sourceToken.tokenId,
    geometry: {
      frame: 'TOKEN_LOCAL' as const,
      shape: {
        kind: 'CIRCLE' as const,
        center: { x: 0, y: 0 },
        radius: area.radius + sourceToken.width / 2
      }
    }
  }
}
