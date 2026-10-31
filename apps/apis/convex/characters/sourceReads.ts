import { ConvexError } from 'convex/values'
import type { AuthoredCurrentSourceIdentity } from '@artificer-toolkit/schema/api/authoredPublication'
import type { CharacterBuilderCommitErrorData } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { canReadAuthoredRoot, readPublishedRootDocument } from '../content/documents'
import { readVerifiedPublicationDocument } from '../content/publicationDocumentRead'
import { readAuthoringSources } from '../content/sources'
import { contentStream } from '../content/streams'
import { requireRulesCatalogueBinding } from '../content/catalogueBinding'
import { readCampaignAssignedCharacter } from '../campaigns/assignedCharacter'
import { requireCampaignAuthority, type CampaignInternalScope } from '../campaigns/authority'
import { readCampaignSharedAuthorizedRoot } from '../campaigns/contentAccess'
import { isImportRowVisible } from '../imports/visibility'
/** History and source reads share current assignment authority without requiring source hydration. */
export async function readCharacterCampaign(
  ctx: QueryCtx,
  character: Pick<CharacterAuthored, 'id' | 'systemId' | 'userId'>,
  userId: string,
  authorityScope?: CampaignInternalScope
) {
  if (character.userId !== userId) throw new Error('Character is not owned by the current user.')
  const { systemId } = character
  const assignment = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
    .unique()
  if (assignment) {
    const { campaign, membership } = await requireCampaignAuthority(
      ctx,
      assignment.campaignId,
      userId,
      authorityScope
    )
    if (
      assignment.userId !== userId ||
      campaign.gameSystemId !== systemId ||
      (await readCampaignAssignedCharacter(ctx, campaign, membership))?.id !== character.id
    )
      throw new Error('Stored Campaign Character assignment mismatch.')
    return campaign
  }
  return null
}

/** Campaign catalogue restrictions apply to every assigned Character source consumer. */
export async function readCharacterSources(
  ctx: QueryCtx,
  character: Pick<CharacterAuthored, 'id' | 'systemId' | 'userId'>,
  userId: string,
  authorityScope?: CampaignInternalScope
) {
  const campaign = await readCharacterCampaign(ctx, character, userId, authorityScope)
  const { systemId } = character
  if (campaign) {
    return readCampaignCharacterSources(ctx, campaign, userId)
  }
  return readSystemCharacterSources(ctx, systemId, userId)
}

/** The caller must already hold Campaign authority for the derived Character owner or GM. */
export async function readCampaignCharacterSources(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  userId: string
) {
  const systemId = campaign.gameSystemId
  const [{ sources: platform }, owned] = await Promise.all([
    requireRulesCatalogueBinding(ctx, {
      systemId,
      primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
      additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
    }),
    ctx.db
      .query('contentSources')
      .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
        q.eq('gameSystemId', systemId).eq('kind', 'USER').eq('ownerUserId', userId)
      )
      .take(101)
  ])
  if (platform.length + owned.length > 100) throw new Error('System content source limit exceeded.')
  return { campaign, sources: [...platform, ...owned] }
}

/** The sources of a Character outside any Campaign: every System catalogue plus own Homebrew. */
export async function readSystemCharacterSources(ctx: QueryCtx, systemId: string, userId: string) {
  const [sources, catalogues] = await Promise.all([
    readAuthoringSources(ctx, systemId, userId),
    ctx.db
      .query('rulesCatalogues')
      .withIndex('by_gameSystemId', (q) => q.eq('gameSystemId', systemId))
      .take(101)
  ])
  // Match the existing complete System catalogue bound; never expose a partial source set.
  if (catalogues.length > 100) throw new Error('System catalogue limit exceeded.')
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const includedIds = new Set<string>()
  for (const catalogue of catalogues) {
    if (
      catalogue.contentSourceIds.length === 0 ||
      catalogue.contentSourceIds.length > 100 ||
      new Set(catalogue.contentSourceIds).size !== catalogue.contentSourceIds.length
    )
      throw new Error('Invalid catalogue content sources.')
    for (const id of catalogue.contentSourceIds) {
      const source = sourceById.get(id)
      if (
        !source ||
        source.kind !== 'PLATFORM' ||
        source.ownerUserId !== null ||
        source.gameSystemId !== systemId
      )
        throw new Error('Invalid catalogue content source binding.')
      includedIds.add(id)
    }
  }
  return {
    campaign: null,
    sources: sources.filter((source) => source.kind === 'USER' || includedIds.has(source.id))
  }
}

/**
 * Whether the Character may read the root's current publication, from root rows alone (D163): an
 * own or enabled source, or an ACTIVE Campaign share whose parents are all readable.
 */
export async function canReadCharacterRoot(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  systemId: string,
  userId: string,
  access: Awaited<ReturnType<typeof readCharacterSources>>,
  sourceIdentities?: Map<string, AuthoredCurrentSourceIdentity>
) {
  if (root.systemId !== systemId) return false
  const source = access.sources.find((source) => source.id === root.contentSourceId)
  const readable =
    (source !== undefined && (await canReadAuthoredRoot(ctx, root, userId, source))) ||
    (access.campaign !== null &&
      (await readCampaignSharedAuthorizedRoot(
        ctx,
        access.campaign,
        root.subjectKind,
        root.id,
        root
      )) !== null)
  if (readable && sourceIdentities) recordCharacterSourceIdentity(sourceIdentities, root)
  return readable
}

/** The current publication of a root the Character may read; views only, commit reads none. */
export async function readCharacterPublication(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  systemId: string,
  userId: string,
  access: Awaited<ReturnType<typeof readCharacterSources>>,
  sourceIdentities?: Map<string, AuthoredCurrentSourceIdentity>
) {
  if (!(await canReadCharacterRoot(ctx, root, systemId, userId, access, sourceIdentities)))
    return null
  return readVerifiedPublicationDocument(
    root.subjectKind,
    (await readPublishedRootDocument(ctx, root)).document
  )
}

/** Commit fails closed when content the Character references cannot be read (ADR 0036 S7). */
export function rejectUnavailableSource(subjectId: string): never {
  throw new ConvexError({
    code: 'SOURCE_UNAVAILABLE',
    subjectId,
    message: 'Content this Character uses is no longer available.'
  } satisfies CharacterBuilderCommitErrorData)
}

/** Record only roots whose current publication or checksum-bound catalogue was authorized. */
export function recordCharacterSourceIdentity(
  sources: Map<string, AuthoredCurrentSourceIdentity>,
  root: Doc<'authoredRoots'>
) {
  sources.set(root.id, {
    subjectKind: root.subjectKind,
    subjectId: root.id,
    systemId: root.systemId,
    contentSourceId: root.contentSourceId,
    versionId: root.currentVersionPublicId,
    checksum: root.checksum
  })
}

export async function readCharacterSourceRoots(
  ctx: QueryCtx,
  systemId: string,
  access: Awaited<ReturnType<typeof readCharacterSources>>,
  kind: Doc<'authoredRoots'>['subjectKind']
) {
  const found: Doc<'authoredRoots'>[] = []
  for (const source of access.sources) {
    const roots = await contentStream(ctx.db)
      .query('authoredRoots')
      .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
        q
          .eq('contentSourceId', source.id)
          .eq('subjectKind', kind)
          .eq('ownerUserId', source.kind === 'USER' ? source.ownerUserId : undefined)
      )
      .filterWith((root) => isImportRowVisible(ctx, root.importJobId))
      .take(501 - found.length)
    // ponytail: complete inline catalogues retain the existing <=500-per-kind limit;
    // larger catalogues need indexed/paginated selection, never partial mechanics.
    if (found.length + roots.length > 500)
      throw new Error('Character sources require paginated search.')
    for (const root of roots) {
      if (root.systemId !== systemId) throw new Error('Stored Character source System mismatch.')
      found.push(root)
    }
  }
  if (access.campaign) {
    const shares = await ctx.db
      .query('campaignContentShares')
      .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
        q.eq('campaignId', access.campaign!.id).eq('subjectKind', kind)
      )
      .take(501)
    if (shares.length > 500) throw new Error('Character sources require paginated search.')
    const foundIds = new Set(found.map((root) => root.id))
    for (const share of shares) {
      if (foundIds.has(share.subjectId)) continue
      const root = await readCampaignSharedAuthorizedRoot(
        ctx,
        access.campaign,
        kind,
        share.subjectId
      )
      if (!root) continue
      if (!(await isImportRowVisible(ctx, root.importJobId))) continue
      found.push(root)
      foundIds.add(root.id)
      if (found.length > 500) throw new Error('Character sources require paginated search.')
    }
  }
  return found
}
