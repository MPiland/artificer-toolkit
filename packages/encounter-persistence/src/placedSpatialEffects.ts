import {
  isEncounterPassiveZone,
  planEncounterPassiveZones,
  type EncounterPassiveZoneCharacterRules
} from '@artificer-toolkit/rules-runtime/encounterPassiveZones'
import type { LiveSessionPlacedSpatialEffect } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from '@artificer-toolkit/schema/shared/spatial'
import type { SceneGrid, SpatialSceneToken } from '@artificer-toolkit/shared/vtt'
import { readEncounterActorTokenBindings } from './actorTokenBindings.js'
import { rejectDomain } from './domainRejections.js'
import type { EncounterPersistenceTransaction } from './ports.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import type { EncounterDocument, EncounterWriteContext } from './store.js'

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

/** What placing passive zones reads from its host: the Scene, and a Character's current rules. */
export interface EncounterPassiveZoneReaders {
  readScene(sceneId: string): Promise<{ grid: SceneGrid; tokens: readonly SpatialSceneToken[] }>
  /**
   * The Character's current rules as the Campaign owner reads them; null when it is unavailable,
   * which places none of its zones.
   */
  readCharacterRules(
    campaign: EncounterDocument<'campaigns'>,
    characterId: string
  ): Promise<EncounterPassiveZoneCharacterRules | null>
}

/**
 * Places the passive zones of the given Creatures and Characters that are bound to tokens in the
 * Encounter's Scene (D144, D155). A zone the actor already has keeps its place, so placing again
 * changes nothing.
 */
export async function placeEncounterPassiveZones(
  ctx: EncounterPersistenceTransaction,
  input: {
    state: EncounterRunState
    campaign: EncounterDocument<'campaigns'>
    actors: readonly EncounterRunActorState[]
    occurrenceId: string
    rootCommandId: string
  },
  readers: EncounterPassiveZoneReaders
) {
  const { state } = input
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  if (!binding) return
  const scope = { encounterId: state.id, sceneId: binding.sceneId }
  const store = await createSpatialRuleEffectStore(ctx).scope(scope)
  if (!store) throw new Error('Placed spatial effect Scene is not bound to the Encounter.')
  const tokenBindings = await readEncounterActorTokenBindings(ctx, state, binding.sceneId)
  const scene = await readers.readScene(binding.sceneId)
  const characterRules = new Map<string, EncounterPassiveZoneCharacterRules>()
  for (const actor of input.actors) {
    if (actor.kind !== 'CHARACTER') continue
    const rules = await readers.readCharacterRules(input.campaign, actor.sourceId)
    if (rules) characterRules.set(actor.sourceId, rules)
  }
  const zones = planEncounterPassiveZones({
    state,
    occurrenceId: input.occurrenceId,
    rootCommandId: input.rootCommandId,
    actors: input.actors,
    system: await ctx.ports.requireSystem(state.gameSystemId),
    sceneGrid: scene.grid,
    tokens: scene.tokens,
    actorIdByTokenId: new Map(tokenBindings.map(({ actorId, tokenId }) => [tokenId, actorId])),
    characterRules
  })
  for (const zone of zones)
    if (!(await store.get(zone.id))) await createPlacedSpatialEffect(ctx, { ...scope, zone })
}

/**
 * Deletes an actor's passive zones (D144): when it leaves the Run, and when its token binding
 * changes, before any new token gets them (D147).
 */
export async function deleteActorPassiveZones(
  ctx: EncounterWriteContext,
  input: { state: EncounterRunState; actorId: string }
) {
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', input.state.id))
    .unique()
  const store =
    binding &&
    (await createSpatialRuleEffectStore(ctx).scope({
      encounterId: input.state.id,
      sceneId: binding.sceneId
    }))
  if (!store) return
  for (const zone of await store.list())
    if (
      isEncounterPassiveZone(zone) &&
      zone.definition.origin.kind === 'ENCOUNTER' &&
      zone.definition.origin.sourceActorId === input.actorId
    )
      await store.deleteCas({ id: zone.id, expectedVersion: zone.version })
}
