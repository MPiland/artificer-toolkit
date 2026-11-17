import { sourceZoneMove } from '@artificer-toolkit/rules-runtime/encounterZoneMove'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '@artificer-toolkit/schema/shared/spatial'
import type { ZoneMoveDto } from '@artificer-toolkit/schema/effects/effectOffer'
import { readSpatialEffect } from './spatialEffectStore.js'
import type { EncounterReadContext } from './store.js'

/**
 * The zones on the Encounter's Scene that `actorId` placed, still maintains and may move (QUALITY-15.T3y8),
 * with the authored move each carries. None when the Run has no Scene.
 */
export async function readActorMovableZones(
  ctx: EncounterReadContext,
  encounterId: string,
  actorId: string
): Promise<{ spatialEffectId: string; label: string; move: ZoneMoveDto }[]> {
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
    .unique()
  if (!binding) return []
  const zones = await ctx.db
    .query('encounterSpatialRuleEffects')
    .withIndex('by_encounterId_sceneId_id', (q) =>
      q.eq('encounterId', encounterId).eq('sceneId', binding.sceneId)
    )
    .take(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
  return zones.map(readSpatialEffect).flatMap((zone) => {
    const move = sourceZoneMove(zone, actorId)
    return move ? [{ spatialEffectId: zone.id, label: zone.placement.label ?? 'Zone', move }] : []
  })
}
