import {
  MAX_SPATIAL_RULE_EFFECTS_PER_SCENE,
  spatialRuleEffectPlacementDtoSchema,
  spatialRuleEffectStateDtoSchema
} from '@artificer-toolkit/schema/shared/spatial'
import type { EncounterReadContext } from './store.js'

/**
 * The placed zones of the Run's bound Scene as the tabletop presents them, in creation order, with
 * the Scene's token bindings. A presentation read on every session read: it parses the placement and
 * reveal state only, as the movement path's full record read (definition and checksums) is where
 * integrity is enforced.
 */
export async function readSceneSpatialRows(ctx: EncounterReadContext, encounterId: string) {
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
    .unique()
  if (!binding) return []
  const rows = await ctx.db
    .query('encounterSpatialRuleEffects')
    .withIndex('by_encounterId_sceneId_createdOrdinal_id', (q) =>
      q.eq('encounterId', encounterId).eq('sceneId', binding.sceneId)
    )
    .take(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
  return rows.map((row) => ({
    id: row.id,
    placement: spatialRuleEffectPlacementDtoSchema.parse(row.placement),
    spatialState: spatialRuleEffectStateDtoSchema.parse(row.spatialState)
  }))
}
