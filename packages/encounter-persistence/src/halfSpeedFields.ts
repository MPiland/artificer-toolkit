import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '@artificer-toolkit/schema/shared/spatial'
import { readSpatialEffect } from './spatialEffectStore.js'
import type { EncounterReadContext } from './store.js'

/**
 * The visible fields in the Run's bound Scene that a voluntary mover may cross carefully. They are
 * the same for every member, so the tabletop can offer the choice before a move is sent.
 */
export async function readHalfSpeedFields(
  ctx: EncounterReadContext,
  encounterId: string
): Promise<EncounterSessionStateDto['halfSpeedFields']> {
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
  return rows
    .map(readSpatialEffect)
    .flatMap(({ id, placement }) =>
      placement.bypassAtHalfSpeed &&
      placement.visibility === 'PUBLIC' &&
      placement.geometry.frame === 'SCENE_ABSOLUTE'
        ? [{ id, label: placement.label ?? null, shape: placement.geometry.shape }]
        : []
    )
}
