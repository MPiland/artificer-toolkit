import { deleteRunActor } from './documents.js'
import type { EncounterWritePorts } from './ports.js'
import type { EncounterWriteContext } from './store.js'

/**
 * Removes the creatures a cast conjured (D187b): each one's Scene token through the room, then the
 * token binding and the actor. The caller drops the ids from the Run's actors, so one removal serves
 * a reverted cast and an effect that ends alike. `commandId` is the command that ends them.
 */
export async function removeConjuredActors(
  ctx: EncounterWriteContext & {
    readonly ports: Pick<EncounterWritePorts<never>, 'removeSummonTokens'>
  },
  input: { encounterId: string; commandId: string; actorIds: readonly string[] }
): Promise<void> {
  if (!ctx.ports.removeSummonTokens)
    throw new Error('Only the Session room can remove a conjured creature from its Scene.')
  const { encounterId, actorIds } = input
  const bindings = []
  for (const actorId of actorIds) {
    const binding = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) =>
        q.eq('encounterId', encounterId).eq('actorId', actorId)
      )
      .unique()
    if (!binding) throw new Error('A conjured creature has no Scene token.')
    bindings.push(binding)
  }
  await ctx.ports.removeSummonTokens({
    encounterId,
    commandId: input.commandId,
    tokens: bindings.map(({ sceneId, tokenId }) => ({ sceneId, tokenId }))
  })
  for (const binding of bindings) await ctx.db.delete(binding._id)
  for (const actorId of actorIds) {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', actorId))
      .unique()
    if (!row) throw new Error('A conjured creature was not found.')
    await deleteRunActor(ctx, row)
  }
}
