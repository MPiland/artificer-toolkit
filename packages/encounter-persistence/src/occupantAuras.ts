import { encounterOccupantAuras } from '@artificer-toolkit/rules-runtime/encounterOccupantAuras'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '@artificer-toolkit/schema/shared/spatial'
import type { SpatialSceneToken } from '@artificer-toolkit/shared/vtt'
import { readEncounterActorTokenBindings } from './actorTokenBindings.js'
import { readRunActors } from './documents.js'
import { readSpatialEffect } from './spatialEffectStore.js'
import type { EncounterReadContext } from './store.js'

/**
 * The occupant auras (D155) holding one actor of the Run, from the Encounter Scene's stored zones
 * and tokens. A Scene without such a zone is answered before its tokens are read.
 */
export async function readEncounterOccupantAuras(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  actorId: string,
  readScene: (sceneId: string) => Promise<{ tokens: readonly SpatialSceneToken[] }>
) {
  if (!state.actorIds.includes(actorId))
    throw new Error('Occupant aura actor is not in the Encounter.')
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  if (!binding) return []
  const effects = (
    await ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_encounterId_sceneId_id', (q) =>
        q.eq('encounterId', state.id).eq('sceneId', binding.sceneId)
      )
      .take(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)
  )
    .map(readSpatialEffect)
    .filter(
      (effect) => effect.placement.occupantSaveBonus || effect.placement.occupantConditionImmunity
    )
  if (!effects.length) return []
  const [tokenBindings, scene, actors] = await Promise.all([
    readEncounterActorTokenBindings(ctx, state, binding.sceneId),
    readScene(binding.sceneId),
    readRunActors(ctx, state)
  ])
  return encounterOccupantAuras({
    targetActorId: actorId,
    actors,
    effects,
    tokens: scene.tokens,
    actorIdByTokenId: new Map(tokenBindings.map((entry) => [entry.tokenId, entry.actorId]))
  })
}
