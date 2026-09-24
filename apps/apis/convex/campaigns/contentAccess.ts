import type { CampaignContentShareDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import {
  canReadAuthoredRoot,
  readAuthoredVersion,
  readPublishedDocument
} from '../content/documents'
import { parsePublicationDocument } from '../content/publicationDocumentRead'
import { requireRulesCatalogueBinding } from '../content/catalogueBinding'
import { requireClassParent } from '../content/classRelationships'
import { requireEquipmentParents, requireRaceParent } from '../content/relationshipReads'

export async function readOwnedCurrentPublication(
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
    !(await canReadAuthoredRoot(ctx, root, ownerUserId))
  )
    return null
  const publication = parsePublicationDocument(
    subjectKind,
    await readPublishedDocument(ctx, root, await readAuthoredVersion(ctx, root))
  )
  return publication.document.status === 'ACTIVE' ? publication : null
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

export async function readCampaignSharedRootPublication(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  subjectKind: CampaignContentShareDto['subjectKind'],
  subjectId: string
) {
  const root = await readCampaignSharedRoot(ctx, campaign, subjectKind, subjectId)
  if (!root) return null
  const publication = parsePublicationDocument(
    subjectKind,
    await readPublishedDocument(ctx, root, await readAuthoredVersion(ctx, root))
  )
  return publication.document.status === 'ACTIVE' &&
    publication.document.systemId === campaign.gameSystemId
    ? publication
    : null
}

/** An explicit Homebrew parent share or an enabled official parent is required at every level. */
export async function requireCampaignContentParents(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  publication: ReturnType<typeof parsePublicationDocument>
) {
  if (
    !(
      (publication.subjectKind === 'CLASS' && publication.document.category === 'SUBCLASS') ||
      (publication.subjectKind === 'RACE' && publication.document.category === 'SUBRACE') ||
      (publication.subjectKind === 'EQUIPMENT' && publication.document.category === 'VARIANT')
    )
  )
    return
  const { sourceIds } = await requireRulesCatalogueBinding(ctx, {
    systemId: campaign.gameSystemId,
    primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
    additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
  })
  const canReadSharedRoot = async (root: Doc<'authoredRoots'>) =>
    (await readCampaignSharedRootPublication(ctx, campaign, root.subjectKind, root.id)) !== null
  // Null owner prevents the sharing author's private access from substituting for a parent share.
  switch (publication.subjectKind) {
    case 'CLASS':
      if (publication.document.category === 'SUBCLASS')
        await requireClassParent(ctx, publication.document, null, sourceIds, canReadSharedRoot)
      break
    case 'RACE':
      if (publication.document.category === 'SUBRACE')
        await requireRaceParent(ctx, publication.document, null, sourceIds, canReadSharedRoot)
      break
    case 'EQUIPMENT':
      await requireEquipmentParents(ctx, publication.document, null, sourceIds, canReadSharedRoot)
      break
  }
}

/** Caller must already hold current Campaign authority; this grants no global authored access. */
export async function readCampaignSharedPublication(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  subjectKind: CampaignContentShareDto['subjectKind'],
  subjectId: string
) {
  const publication = await readCampaignSharedRootPublication(ctx, campaign, subjectKind, subjectId)
  if (publication) await requireCampaignContentParents(ctx, campaign, publication)
  return publication
}
