import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  MAX_SPATIAL_RULE_EFFECTS_PER_SCENE,
  spatialRuleEffectPlacementDtoSchema,
  spatialRuleEffectStateDtoSchema
} from '@artificer-toolkit/schema/shared/spatial'
import { isVisibleHalfSpeedField } from '@artificer-toolkit/rules-runtime/halfSpeedField'
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
  // A presentation read on every session read: it parses the placement and reveal state only, as
  // the movement path's full record read (definition and checksums) is where integrity is enforced.
  return rows.flatMap((row) => {
    const field = {
      placement: spatialRuleEffectPlacementDtoSchema.parse(row.placement),
      spatialState: spatialRuleEffectStateDtoSchema.parse(row.spatialState)
    }
    const { placement } = field
    return isVisibleHalfSpeedField(field) && placement.geometry.frame === 'SCENE_ABSOLUTE'
      ? [{ id: row.id, label: placement.label ?? null, shape: placement.geometry.shape }]
      : []
  })
}
