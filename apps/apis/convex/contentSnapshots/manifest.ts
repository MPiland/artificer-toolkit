import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  contentSnapshotCatalogueManifestDtoSchema,
  contentSnapshotManifestDtoSchema,
  contentSnapshotManifestInputSchema,
  contentSnapshotTokenGrantSchema,
  type ContentSnapshotCatalogueManifestDto,
  type ContentSnapshotManifestDto,
  type ContentSnapshotTokenGrant
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { QueryCtx } from '../_generated/server'
import { internalQuery, query } from '../lib/queries'
import { resolveCharacterId } from '../characters/documents'
import { readCharacterSources, readSystemCharacterSources } from '../characters/sourceReads'
import { loadCharacterState } from '../characters/stateDocuments'
import { requireIdentity } from '../lib/identity'
import type { ContentSnapshotScopeRef } from './marking'

// ADR 0036. `docs/architecture/persistence.md` describes delivery and the visible set.

async function readHead(ctx: QueryCtx, { scope, scopeId }: ContentSnapshotScopeRef) {
  const head = await ctx.db
    .query('contentSnapshotHeads')
    .withIndex('by_scope_scopeId', (q) => q.eq('scope', scope).eq('scopeId', scopeId))
    .unique()
  // The contract head, without build bookkeeping.
  return (
    head && {
      scope,
      scopeId,
      revision: head.revision,
      builtRevision: head.builtRevision,
      kinds: head.kinds
    }
  )
}

/** Builds heads from an already authorized source set; it grants no additional scope. */
export async function readContentSnapshotManifest(
  ctx: QueryCtx,
  systemId: string,
  access: Awaited<ReturnType<typeof readCharacterSources>>
): Promise<ContentSnapshotManifestDto> {
  const sources = await Promise.all(
    access.sources.map(async (source) => ({
      contentSourceId: source.id,
      kind: source.kind,
      head: await readHead(ctx, { scope: 'SOURCE', scopeId: source.id })
    }))
  )
  const { campaign } = access
  return contentSnapshotManifestDtoSchema.parse({
    systemId,
    sources,
    campaign: campaign && {
      id: campaign.id,
      contentMaturity: campaign.contentMaturity,
      head: await readHead(ctx, { scope: 'CAMPAIGN', scopeId: campaign.id })
    }
  })
}

/**
 * The snapshot heads a Builder may read, by exactly the Builder's source rules
 * (`readCharacterSources`): the enabled catalogues (the Campaign's, for an assigned Character) and
 * the caller's own Homebrew, plus the Campaign's shares. Without a Character, no Campaign applies.
 */
export const manifest = query({
  args: zodToConvexFields(contentSnapshotManifestInputSchema.shape),
  returns: zodToConvex(contentSnapshotManifestDtoSchema),
  handler: async (ctx, args): Promise<ContentSnapshotManifestDto> => {
    const { userId } = await requireIdentity(ctx)
    const { systemId, characterId } = contentSnapshotManifestInputSchema.parse(args)
    let access: Awaited<ReturnType<typeof readCharacterSources>>
    if (characterId === undefined) {
      access = await readSystemCharacterSources(ctx, systemId, userId)
    } else {
      const id = await resolveCharacterId(ctx, characterId)
      const state = id ? await loadCharacterState(ctx, id) : null
      const records = state ? [state.active, state.draft].filter((record) => record !== null) : []
      if (
        !id ||
        records.length === 0 ||
        records.some((record) => record.userId !== userId || record.systemId !== systemId)
      )
        throw new Error('Character content is unavailable for the current user.')
      access = await readCharacterSources(ctx, { id, systemId, userId }, userId)
    }
    return readContentSnapshotManifest(ctx, systemId, access)
  }
})

// Above the Builder's per-System source bound; more fails closed instead of truncating the grant.
const MAX_TOKEN_SCOPES = 100

/**
 * The snapshot heads the authored-content lists read: every PLATFORM source and the caller's own
 * Homebrew sources across Systems, with no Campaign shares (the visible set of
 * `buildContentCatalogueItems`).
 */
export const catalogue = query({
  args: {},
  returns: zodToConvex(contentSnapshotCatalogueManifestDtoSchema),
  handler: async (ctx): Promise<ContentSnapshotCatalogueManifestDto> => {
    const { userId } = await requireIdentity(ctx)
    const [platform, owned] = await Promise.all([
      ctx.db
        .query('contentSources')
        .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', null))
        .take(MAX_TOKEN_SCOPES + 1),
      ctx.db
        .query('contentSources')
        .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId))
        .take(MAX_TOKEN_SCOPES + 1)
    ])
    if (platform.length + owned.length > MAX_TOKEN_SCOPES)
      throw new Error('Catalogue content source limit exceeded.')
    return contentSnapshotCatalogueManifestDtoSchema.parse({
      userId,
      sources: await Promise.all(
        [...platform, ...owned].map(async (source) => ({
          contentSourceId: source.id,
          systemId: source.gameSystemId,
          kind: source.kind,
          head: await readHead(ctx, { scope: 'SOURCE', scopeId: source.id })
        }))
      )
    })
  }
})

/** The private scopes named in a content token: own USER sources and active, undeleted Campaigns. */
export const readTokenGrant = internalQuery({
  args: {},
  returns: zodToConvex(contentSnapshotTokenGrantSchema),
  handler: async (ctx): Promise<ContentSnapshotTokenGrant> => {
    const { userId } = await requireIdentity(ctx)
    const [sources, memberships] = await Promise.all([
      ctx.db
        .query('contentSources')
        .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId))
        .take(MAX_TOKEN_SCOPES + 1),
      ctx.db
        .query('campaignMemberships')
        .withIndex('by_userId_status_joinedAt', (q) =>
          q.eq('userId', userId).eq('status', 'ACTIVE')
        )
        .take(MAX_TOKEN_SCOPES + 1)
    ])
    if (sources.length > MAX_TOKEN_SCOPES || memberships.length > MAX_TOKEN_SCOPES)
      throw new Error('Content access scope limit exceeded.')
    const campaignIds: string[] = []
    for (const { campaignId } of memberships) {
      const deletion = await ctx.db
        .query('campaignDeletionJobs')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
        .unique()
      if (!deletion) campaignIds.push(campaignId)
    }
    return contentSnapshotTokenGrantSchema.parse({
      sub: userId,
      userSourceIds: sources.filter((source) => source.kind === 'USER').map((source) => source.id),
      campaignIds
    })
  }
})
