import {
  AUTHORED_SOURCE_FACTS_VERSION,
  authoredNodeRuntimeSourceFactsSchema,
  type AuthoredNodeRuntimeSourceFacts
} from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type RootIdentity = Pick<Doc<'authoredRoots'>, 'id' | 'checksum'>

async function findSourceFacts(ctx: QueryCtx, subjectId: string) {
  return await ctx.db
    .query('authoredSourceFacts')
    .withIndex('by_subjectId', (q) => q.eq('subjectId', subjectId))
    .unique()
}

/** The root's stored facts as written (any version), or null when none are stored. */
export async function readStoredSourceFacts(ctx: QueryCtx, root: RootIdentity) {
  const row = await findSourceFacts(ctx, root.id)
  return row ? authoredNodeRuntimeSourceFactsSchema.parse(row.facts) : null
}

/** The root's current, checksum-bound facts; any other state is a stored-data fault. */
export async function readSourceFacts(
  ctx: QueryCtx,
  root: RootIdentity
): Promise<AuthoredNodeRuntimeSourceFacts> {
  const facts = await readStoredSourceFacts(ctx, root)
  if (!facts) throw new Error('Authoring source facts are not materialized.')
  if (facts.checksum !== root.checksum)
    throw new Error('Stored authoring source checksum mismatch.')
  if (facts.factsVersion !== AUTHORED_SOURCE_FACTS_VERSION)
    throw new Error('Stored authoring source facts are superseded; run content/sourceMigrations.')
  return facts
}

export async function writeSourceFacts(
  ctx: MutationCtx,
  subjectId: string,
  facts: AuthoredNodeRuntimeSourceFacts
) {
  const row = await findSourceFacts(ctx, subjectId)
  if (row) await ctx.db.replace(row._id, { subjectId, facts })
  else await ctx.db.insert('authoredSourceFacts', { subjectId, facts })
}

export async function deleteSourceFacts(ctx: MutationCtx, subjectId: string) {
  const row = await findSourceFacts(ctx, subjectId)
  if (row) await ctx.db.delete(row._id)
}
