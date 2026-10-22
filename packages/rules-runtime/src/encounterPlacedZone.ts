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
  undirectedAreaGeometry,
  type ScenePoint,
  type SpatialAreaShape,
  type SpatialPointAreaShape,
  type SpatialWallAreaShape,
  type SpatialWallSide,
  wallSideBandGeometry
} from '@artificer-toolkit/shared/vtt'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { AbilityCode } from '@artificer-toolkit/shared/core'

import { compileEffectGraph } from './encounterActionEffectPlans.js'
import { selectScalingRow } from './scalingRowSelection.js'

type ZoneRegionComponent = NonNullable<CompiledActionZonePlacement['regionComponents']>[number]
type OccupantSaveBonus = NonNullable<CompiledActionZonePlacement['occupantSaveBonus']>

/**
 * What placement resolves a zone against (D155): its source's ability modifiers, by ability code,
 * and its level in each class. A source with no level in a class is at level 0 in it.
 */
export interface PlacedZoneSource {
  abilityModifier(ability: AbilityCode): number
  classLevel(classId: string): number
}

/**
 * A zone's shape at its source (D155): a radius scaled by class level takes the row the source's
 * level in that class reaches, or the authored radius below every row. Any other shape is as authored.
 */
export function zoneShapeAtSource(
  shape: CompiledActionZonePlacement['shape'],
  source: PlacedZoneSource
): CompiledActionZonePlacement['shape'] {
  if (!('radius' in shape) || !shape.radius.scaling) return shape
  const { scaling, ...radius } = shape.radius
  if (scaling.scalingSource !== 'CLASS_LEVEL' || !('classId' in scaling))
    throw new Error('A zone radius scaled by class level is resolved against its source.')
  const row = selectScalingRow(scaling.breakpoints, source.classLevel(scaling.classId))
  return { ...shape, radius: row ? { ...radius, ...row.value } : radius }
}

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
export function planEncounterPlacedZone(
  input: PlacedZoneInput & { id: string }
): LiveSessionPlacedSpatialEffect {
  const { zone, point, area } = input
  if (isDirectedAreaShape(area)) throw new Error('A placed zone needs a point-origin area.')
  if (Boolean(zone.perDistanceMoved) !== (input.distanceStep !== undefined))
    throw new Error('A zone acting per distance moved has its step resolved, and only such a zone.')
  return placedZoneRecord(
    input,
    input.id,
    zone,
    zoneAnchor(zone.attachment, area, point, input.sourceToken),
    input.distanceStep
  )
}

/**
 * The records a zone's region components place beside its wall (D154), one per component in order
 * with the id at its index: each covers its band on the side the caster picked, fixed to the Scene,
 * and is maintained, pinned and spares creatures as the zone's own record does.
 */
export function planEncounterZoneBands(
  input: PlacedZoneInput & {
    ids: readonly string[]
    /** Each region component's side and reach in Scene coordinates, in order. */
    regions: readonly { side: SpatialWallSide; distance: number }[]
  }
): LiveSessionPlacedSpatialEffect[] {
  const components = input.zone.regionComponents ?? []
  const { area, point } = input
  if (components.length !== input.regions.length || components.length !== input.ids.length)
    throw new Error('Each band a zone reaches has its side and its id.')
  if (!components.length) return []
  if (area.kind !== 'WALL' && area.kind !== 'RING')
    throw new Error('A band reaches beside a wall or a ring.')
  return components.map((component, index) => {
    const { side, distance } = input.regions[index]!
    const shape = wallSideBandGeometry(point, area, side, distance)
    if (!shape) throw new Error('A band covers some of the Scene on a side its wall has.')
    return placedZoneRecord(input, input.ids[index]!, component, {
      anchorKind: 'FIXED' as const,
      sourceTokenId: null,
      geometry: { frame: 'SCENE_ABSOLUTE' as const, shape }
    })
  })
}

type PlacedZoneInput = {
  zone: CompiledActionZonePlacement
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
  /** The zone's per-distance-moved step in Scene distance units; absent when it acts on entry. */
  distanceStep?: number
  /**
   * What a zone resolved against its source is resolved against (D155); absent when it needs none.
   * The caller sizes `area` from {@link zoneShapeAtSource}.
   */
  source?: PlacedZoneSource
  /** Creatures the caster designated at cast; the zone never catches them. */
  unaffectedActorIds?: readonly string[]
}

/** What a placed record of one zone component holds: its entry, triggers and the area it covers. */
function placedZoneRecord(
  input: PlacedZoneInput,
  id: string,
  zone: Omit<ZoneRegionComponent, 'region'> &
    Pick<CompiledActionZonePlacement, 'retaliatesMeleeHits' | 'occupantSaveBonus'>,
  anchor: ReturnType<typeof zoneAnchor>,
  distanceStep?: number
): LiveSessionPlacedSpatialEffect {
  const { entry, grant, heldCondition } = zone
  const pinnedDc = entry.castSaveDcFactKey
    ? { [entry.castSaveDcFactKey]: castSaveDc(input.saveDc) }
    : {}
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 2,
    linkedEffectId: null,
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
    stateContributions: grant
      ? [
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
      : []
  })
  return {
    id,
    maintainedEffectStateId: input.maintainedEffectStateId,
    definition,
    lifecycle: { schemaVersion: 1, remainingTicks: null },
    placement: spatialRuleEffectPlacementDtoSchema.parse({
      schemaVersion: 1,
      ...anchor,
      triggerModes: zone.triggerModes,
      ...(zone.turnTriggers ? { turnTriggers: zone.turnTriggers } : {}),
      // A creature teleporting travels no distance through a zone acting per distance moved.
      movementKinds: distanceStep ? ['VOLUNTARY', 'FORCED'] : ['VOLUNTARY', 'FORCED', 'TELEPORT'],
      ...(distanceStep ? { distanceStep } : {}),
      activation: 'REPEATABLE',
      visibility: 'PUBLIC',
      revealOnTrigger: false,
      label: zone.label,
      bypassAtHalfSpeed: zone.bypassAtHalfSpeed,
      ...(zone.maxApplicationsPerTurn !== undefined
        ? { maxApplicationsPerTurn: zone.maxApplicationsPerTurn }
        : {}),
      ...(zone.requiresFullyWithin ? { requiresFullyWithin: true } : {}),
      ...(zone.requiredSight ? { requiredSight: zone.requiredSight } : {}),
      ...(zone.movementCostMultiplier
        ? { movementCostMultiplier: zone.movementCostMultiplier }
        : {}),
      ...(zone.blockingRules ? { blockingRules: zone.blockingRules } : {}),
      ...(zone.failedSaveLosesAction ? { failedSaveLosesAction: true } : {}),
      ...(zone.retaliatesMeleeHits ? { retaliatesMeleeHits: true } : {}),
      ...(zone.occupantSaveBonus
        ? { occupantSaveBonus: pinnedOccupantSaveBonus(zone.occupantSaveBonus, input.source) }
        : {}),
      // A held condition's escape against its source's save DC pins the caster's DC (D146).
      ...(heldCondition
        ? {
            heldCondition: {
              ...heldCondition,
              ...(heldCondition.escape
                ? {
                    escape: {
                      ...heldCondition.escape,
                      dc:
                        heldCondition.escape.dc.kind === 'FIXED'
                          ? heldCondition.escape.dc.value
                          : castSaveDc(input.saveDc)
                    }
                  }
                : {})
            }
          }
        : {}),
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

/** A save bonus with its amount pinned (D155): fixed, or the source's modifier with its minimum. */
function pinnedOccupantSaveBonus(
  { domain, dispositionFilter, amount }: OccupantSaveBonus,
  source: PlacedZoneSource | undefined
) {
  if (amount.kind === 'FIXED') return { domain, dispositionFilter, amount: amount.value }
  if (!source) throw new Error('A save bonus from its source’s modifier is resolved against it.')
  const modifier = source.abilityModifier(amount.ability)
  return {
    domain,
    dispositionFilter,
    amount: amount.minimum === null ? modifier : Math.max(modifier, amount.minimum)
  }
}

function castSaveDc(saveDc: number | null): number {
  if (saveDc === null) throw new Error('A zone that uses its user’s save DC needs it resolved.')
  return saveDc
}

/** Where a zone sits: fixed at the picked point, or on its user's token and moving with it. */
function zoneAnchor(
  attachment: CompiledActionZonePlacement['attachment'],
  area: SpatialPointAreaShape | SpatialWallAreaShape,
  point: ScenePoint,
  sourceToken: { tokenId: string; width: number } | null
) {
  if (attachment === 'PLACED_SPACE') {
    const shape = undirectedAreaGeometry(point, area)
    if (!shape) throw new Error('A placed zone covers some of the Scene.')
    return {
      anchorKind: 'FIXED' as const,
      sourceTokenId: null,
      geometry: { frame: 'SCENE_ABSOLUTE' as const, shape }
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
