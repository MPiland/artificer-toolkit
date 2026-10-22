import type { LootOwner } from '@artificer-toolkit/schema/api/lootTables'
import type { MutationCtx, QueryCtx } from '../_generated/server'

function findActorLoot(ctx: QueryCtx, encounterId: string, actorId: string) {
  return ctx.db
    .query('lootTables')
    .withIndex('by_actor', (q) =>
      q
        .eq('owner.kind', 'ENCOUNTER_ACTOR')
        .eq('owner.encounterId', encounterId)
        .eq('owner.actorId', actorId)
    )
    .unique()
}

/** The one stored loot row for an owner, or null when none has been saved. */
export function findLootRow(ctx: QueryCtx, owner: LootOwner) {
  if (owner.kind === 'ENCOUNTER_ACTOR') return findActorLoot(ctx, owner.encounterId, owner.actorId)
  return ctx.db
    .query('lootTables')
    .withIndex('by_scene', (q) =>
      q.eq('owner.kind', 'SCENE').eq('owner.sceneDefinitionId', owner.sceneDefinitionId)
    )
    .unique()
}

/** A removed placement takes its loot with it. */
export async function removeActorLoot(ctx: MutationCtx, encounterId: string, actorId: string) {
  const row = await findActorLoot(ctx, encounterId, actorId)
  if (row) await ctx.db.delete(row._id)
}
