import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function isImportRowVisible(
  ctx: QueryCtx | MutationCtx,
  importJobId: string | undefined,
  currentJobId?: string
) {
  if (!importJobId || importJobId === currentJobId) return true
  const job = await ctx.db
    .query('importJobs')
    .withIndex('by_publicId', (query) => query.eq('id', importJobId))
    .unique()
  return job?.status === 'COMPLETED'
}
