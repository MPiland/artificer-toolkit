import { encounterActorTokenBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterReadContext } from './store.js'

/** Reads the current Encounter actor-token identities, optionally pinned to one Scene. */
export async function readEncounterActorTokenBindings(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  expectedSceneId?: string
) {
  const rows = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', state.id))
    .take(state.actorIds.length + 1)
  if (rows.length > state.actorIds.length)
    throw new Error('Encounter actor token binding is unavailable.')
  const actorIds = new Set<string>()
  const tokenIds = new Set<string>()
  return rows.map((row) => {
    const { _id, _creationTime, ...stored } = row
    const binding = encounterActorTokenBindingSchema.parse(stored)
    if (
      binding.encounterId !== state.id ||
      (expectedSceneId !== undefined && binding.sceneId !== expectedSceneId) ||
      !state.actorIds.includes(binding.actorId) ||
      actorIds.has(binding.actorId) ||
      tokenIds.has(binding.tokenId)
    )
      throw new Error('Encounter actor token binding is unavailable.')
    actorIds.add(binding.actorId)
    tokenIds.add(binding.tokenId)
    return { actorId: binding.actorId, tokenId: binding.tokenId }
  })
}
