import { campaignStoredRevisionSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

// A Campaign's version, change time and notebook revision live in `campaignRevisions`, one row per
// Campaign, created and deleted with its root (D216). Authority reads only the root, so advancing a
// revision reruns only the readers that return or check these fields.

export async function insertCampaignRevision(ctx: MutationCtx, campaignId: string, now: string) {
  await ctx.db.insert(
    'campaignRevisions',
    campaignStoredRevisionSchema.parse({
      campaignId,
      version: 0,
      updatedAt: now,
      notebookRevision: null
    })
  )
}

export async function readCampaignRevision(ctx: QueryCtx, campaignId: string) {
  const revision = await ctx.db
    .query('campaignRevisions')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
  if (!revision) throw new Error('Stored Campaign revision is missing.')
  return revision
}

/** The revision a command's expected version names, or the stale-command refusal. */
export async function requireCampaignVersion(
  ctx: QueryCtx,
  campaignId: string,
  expectedVersion: number
) {
  const revision = await readCampaignRevision(ctx, campaignId)
  if (revision.version !== expectedVersion)
    throw new Error('Campaign changed before this action completed.')
  return revision
}

/** A change time strictly after the Campaign's last change and no earlier than `floor`. */
export function nextCampaignChangeTime(revision: Doc<'campaignRevisions'>, floor = Date.now()) {
  return new Date(Math.max(floor, Date.parse(revision.updatedAt) + 1)).toISOString()
}

export async function advanceCampaignRevision(
  ctx: MutationCtx,
  revision: Doc<'campaignRevisions'>,
  floor?: number
) {
  const next = { version: revision.version + 1, updatedAt: nextCampaignChangeTime(revision, floor) }
  await ctx.db.patch(revision._id, next)
  return next
}
