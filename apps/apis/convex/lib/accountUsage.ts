import type { AccountUsageResource } from '@artificer-toolkit/schema/projections/accountUsage'
import {
  accountUsageSchema,
  zeroAccountUsage
} from '@artificer-toolkit/schema/projections/accountUsage'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { isImportRowVisible } from '../imports/visibility'

async function ownerForSource(
  ctx: MutationCtx,
  resource: AccountUsageResource,
  sourceId: string
): Promise<string | null> {
  if (resource === 'personalCharacters') {
    const [character, draft] = await Promise.all([
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', sourceId))
        .unique(),
      ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', sourceId))
        .unique()
    ])
    if (character && draft && character.userId !== draft.userId)
      throw new Error('Character ownership is inconsistent.')
    return character?.userId ?? draft?.userId ?? null
  }
  if (resource === 'homebrewRoots') {
    const [root, draft] = await Promise.all([
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', sourceId))
        .unique(),
      ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', sourceId))
        .unique()
    ])
    const [visibleRoot, visibleDraft] = await Promise.all([
      root && isImportRowVisible(ctx, root.importJobId),
      draft && isImportRowVisible(ctx, draft.importJobId)
    ])
    if (!visibleRoot && !visibleDraft) return null
    if (visibleRoot && root?.ownerUserId === undefined && !visibleDraft) return null
    if (
      visibleRoot &&
      visibleDraft &&
      root &&
      draft &&
      (root.ownerUserId !== draft.userId || root.subjectKind !== draft.subjectKind)
    )
      throw new Error('Authored content ownership is inconsistent.')
    return (
      (visibleRoot ? root?.ownerUserId : undefined) ??
      (visibleDraft ? draft?.userId : undefined) ??
      null
    )
  }
  if (resource === 'activeHostedCampaigns') {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', sourceId))
      .unique()
    return campaign?.status === 'ACTIVE' ? campaign.ownerUserId : null
  }
  if (resource === 'publicListings') {
    const listing = await ctx.db
      .query('socialListings')
      .withIndex('by_publicId', (q) => q.eq('id', sourceId))
      .unique()
    if (listing?.status !== 'OPEN' || listing.audience !== 'PUBLIC') return null
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', listing.campaignId))
      .unique()
    if (!campaign || campaign.status !== 'ACTIVE') return null
    if (campaign.ownerUserId !== listing.ownerUserId)
      throw new Error('Listing ownership is inconsistent.')
    return listing.ownerUserId
  }
  const blueprint = await ctx.db
    .query('encounterBlueprints')
    .withIndex('by_publicId', (q) => q.eq('id', sourceId))
    .unique()
  return blueprint?.ownerUserId ?? null
}

async function changeUsage(
  ctx: MutationCtx,
  profile: Doc<'userProfiles'>,
  resource: AccountUsageResource,
  delta: number
) {
  const usage = accountUsageSchema.parse(profile.entitlementUsage ?? zeroAccountUsage)
  const next = usage[resource] + delta
  if (next < 0) throw new Error('Account usage counter underflow.')
  if (!Number.isSafeInteger(next))
    throw new Error('Account usage counter exceeds safe integer range.')
  await ctx.db.patch(profile._id, { entitlementUsage: { ...usage, [resource]: next } })
}

export async function syncAccountUsage(
  ctx: MutationCtx,
  resource: AccountUsageResource,
  sourceId: string,
  /** The source's owner, when the caller has just written the source and verified ownership. */
  writtenOwnerUserId?: string | null
): Promise<void> {
  const existing = await ctx.db
    .query('accountUsageEntries')
    .withIndex('by_resource_sourceId', (q) => q.eq('resource', resource).eq('sourceId', sourceId))
    .unique()
  if (existing && !(await isImportRowVisible(ctx, existing.importJobId))) return
  const resolvedOwnerUserId =
    writtenOwnerUserId !== undefined
      ? writtenOwnerUserId
      : await ownerForSource(ctx, resource, sourceId)
  const currentOwnerProfile = resolvedOwnerUserId
    ? await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', resolvedOwnerUserId))
        .unique()
    : null
  const ownerUserId = currentOwnerProfile ? resolvedOwnerUserId : null
  if (existing?.ownerUserId === ownerUserId) return
  if (existing) {
    const oldOwnerProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', existing.ownerUserId))
      .unique()
    if (oldOwnerProfile) await changeUsage(ctx, oldOwnerProfile, resource, -1)
  }
  if (currentOwnerProfile) await changeUsage(ctx, currentOwnerProfile, resource, 1)
  if (existing && ownerUserId) await ctx.db.patch(existing._id, { ownerUserId })
  else if (existing) await ctx.db.delete(existing._id)
  else if (ownerUserId)
    await ctx.db.insert('accountUsageEntries', { resource, sourceId, ownerUserId })
}
