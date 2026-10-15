import type { LiveSessionPlacedSpatialEffect } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '@artificer-toolkit/schema/shared/spatial'
import { rejectDomain } from './domainRejections.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import type { EncounterWriteContext } from './store.js'

/** Stores the zone an action placed in the Scene it was aimed in; a full Scene refuses the action. */
export async function createPlacedSpatialEffect(
  ctx: EncounterWriteContext,
  input: { encounterId: string; sceneId: string; zone: LiveSessionPlacedSpatialEffect }
) {
  const store = await createSpatialRuleEffectStore(ctx).scope(input)
  if (!store) throw new Error('Placed spatial effect Scene is not bound to the Encounter.')
  if ((await store.list()).length >= MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
    rejectDomain(
      'TARGET_UNAVAILABLE',
      `This Scene already holds ${MAX_SPATIAL_RULE_EFFECTS_PER_SCENE} spatial effects.`
    )
  await store.create(input.zone)
}

/** Deletes the zone an undone action placed. A zone that is already gone (it triggered) needs nothing. */
export async function deletePlacedSpatialEffect(
  ctx: EncounterWriteContext,
  input: { encounterId: string; id: string }
) {
  const row = await ctx.db
    .query('encounterSpatialRuleEffects')
    .withIndex('by_publicId', (q) => q.eq('id', input.id))
    .unique()
  if (!row || row.encounterId !== input.encounterId) return
  const store = await createSpatialRuleEffectStore(ctx).scope({
    encounterId: row.encounterId,
    sceneId: row.sceneId
  })
  const current = await store?.get(input.id)
  if (store && current) await store.deleteCas({ id: current.id, expectedVersion: current.version })
}
