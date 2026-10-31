import type { CampaignContentShareDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { canReadAuthoredRoot, readPublishedRootDocument } from '../content/documents'
import { readRootCatalogue } from '../content/catalogueMetadata'
import { readVerifiedPublicationDocument } from '../content/publicationDocumentRead'
import { requireRulesCatalogueBinding } from '../content/catalogueBinding'
import { requireParentRoots, rootParentId } from '../content/relationshipReads'

/** The current publication's validated payload; authorization reads the root alone. */
export async function readCurrentPublication(ctx: QueryCtx, root: Doc<'authoredRoots'>) {
  const { document } = await readPublishedRootDocument(ctx, root)
  return readVerifiedPublicationDocument(root.subjectKind, document)
}

/** An owner's own root whose current publication is ACTIVE, from the root row alone (D163). */
export async function readOwnedCurrentRoot(
  ctx: QueryCtx,
  subjectKind: CampaignContentShareDto['subjectKind'],
  subjectId: string,
  ownerUserId: string
) {
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', subjectId))
    .unique()
  if (
    !root ||
    root.subjectKind !== subjectKind ||
    root.ownerUserId !== ownerUserId ||
    !(await canReadAuthoredRoot(ctx, root, ownerUserId)) ||
    !readRootCatalogue(root).publishedActive
  )
    return null
  return root
}

export async function readOwnedCurrentPublication(
  ctx: QueryCtx,
  subjectKind: CampaignContentShareDto['subjectKind'],
  subjectId: string,
  ownerUserId: string
) {
  const root = await readOwnedCurrentRoot(ctx, subjectKind, subjectId, ownerUserId)
  return root && readCurrentPublication(ctx, root)
}

/** Header access only; publication status and parent relationships still require validation. */
export async function readCampaignSharedRoot(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  subjectKind: CampaignContentShareDto['subjectKind'],
  subjectId: string,
  currentRoot?: Doc<'authoredRoots'>
) {
  const share = await ctx.db
    .query('campaignContentShares')
    .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
      q.eq('campaignId', campaign.id).eq('subjectKind', subjectKind).eq('subjectId', subjectId)
    )
    .unique()
  if (!share) return null
  const author = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', campaign.id).eq('userId', share.sharedBy)
    )
    .unique()
  if (!author || author.status !== 'ACTIVE') return null
  if ((author.role === 'OWNER') !== (campaign.ownerUserId === author.userId))
    throw new Error('Stored Campaign authority mismatch.')
  const root =
    currentRoot ??
    (await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', subjectId))
      .unique())
  if (
    !root ||
    root.id !== subjectId ||
    root.subjectKind !== subjectKind ||
    root.ownerUserId !== share.sharedBy ||
    root.systemId !== campaign.gameSystemId ||
    !(await canReadAuthoredRoot(ctx, root, share.sharedBy))
  )
    return null
  return root
}

/** A shared root whose current publication is ACTIVE; parent relationships still need validation. */
export async function readCampaignSharedActiveRoot(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  subjectKind: CampaignContentShareDto['subjectKind'],
  subjectId: string,
  currentRoot?: Doc<'authoredRoots'>
) {
  const root = await readCampaignSharedRoot(ctx, campaign, subjectKind, subjectId, currentRoot)
  return root && readRootCatalogue(root).publishedActive ? root : null
}

export async function readCampaignSharedRootPublication(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  subjectKind: CampaignContentShareDto['subjectKind'],
  subjectId: string
) {
  const root = await readCampaignSharedActiveRoot(ctx, campaign, subjectKind, subjectId)
  return root && readCurrentPublication(ctx, root)
}

/** An explicit Homebrew parent share or an enabled official parent is required at every level. */
export async function requireCampaignContentParents(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  root: Doc<'authoredRoots'>
) {
  if (rootParentId(root) === null) return
  const { sourceIds } = await requireRulesCatalogueBinding(ctx, {
    systemId: campaign.gameSystemId,
    primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
    additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
  })
  // Null owner prevents the sharing author's private access from substituting for a parent share.
  await requireParentRoots(ctx, root, {
    userId: null,
    allowedSourceIds: sourceIds,
    canReadSharedRoot: async (parent) =>
      (await readCampaignSharedActiveRoot(ctx, campaign, parent.subjectKind, parent.id, parent)) !==
      null
  })
}

/**
 * Whether each parent of a shared child is itself a readable share, up to an enabled official
 * root. A false result excludes the child where `requireCampaignContentParents` would reject it.
 */
export async function hasCampaignContentParents(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  root: Doc<'authoredRoots'>
) {
  let parentId = rootParentId(root)
  if (parentId === null) return true
  const { sourceIds } = await requireRulesCatalogueBinding(ctx, {
    systemId: campaign.gameSystemId,
    primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
    additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
  })
  const visited = new Set([root.id])
  while (parentId !== null) {
    const id = parentId
    if (visited.has(id)) return false
    visited.add(id)
    const shared = await readCampaignSharedActiveRoot(ctx, campaign, root.subjectKind, id)
    if (!shared) {
      const parent = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
      return (
        parent !== null &&
        sourceIds.has(parent.contentSourceId) &&
        (await canReadAuthoredRoot(ctx, parent, null))
      )
    }
    parentId = rootParentId(shared)
  }
  return true
}

/** A shared ACTIVE root whose parents are all readable, from root rows alone (D163). */
export async function readCampaignSharedAuthorizedRoot(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  subjectKind: CampaignContentShareDto['subjectKind'],
  subjectId: string,
  currentRoot?: Doc<'authoredRoots'>
) {
  const root = await readCampaignSharedActiveRoot(
    ctx,
    campaign,
    subjectKind,
    subjectId,
    currentRoot
  )
  if (root) await requireCampaignContentParents(ctx, campaign, root)
  return root
}

/** Caller must already hold current Campaign authority; this grants no global authored access. */
export async function readCampaignSharedPublication(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  subjectKind: CampaignContentShareDto['subjectKind'],
  subjectId: string
) {
  const root = await readCampaignSharedAuthorizedRoot(ctx, campaign, subjectKind, subjectId)
  return root && readCurrentPublication(ctx, root)
}
