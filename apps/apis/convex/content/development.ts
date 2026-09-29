import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { authoredSubjectKindSchema } from '@artificer-toolkit/schema/projections/identity'
import { internalMutation } from '../lib/mutations'
import { internalQuery } from '../lib/queries'
import { requireFixtureAccount } from '../lib/developmentFixtures'

// Internal CLI fixture setup only; product callers cannot grant themselves a paid tier.
export const setFixturePlayerTier = internalMutation({
  args: { userId: v.string(), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { userId, enabled }) => {
    await requireFixtureAccount(ctx, userId)
    const [entitlement, root, draft] = await Promise.all([
      ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique(),
      ctx.db
        .query('authoredRoots')
        .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId))
        .first(),
      ctx.db
        .query('authoredDrafts')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .first()
    ])
    if (root || draft || (entitlement && entitlement.tier !== 'PLAYER'))
      throw new Error('An empty fixture account without another tier is required.')
    if (enabled && !entitlement)
      await ctx.db.insert('accountEntitlements', { userId, tier: 'PLAYER' })
    if (!enabled && entitlement) await ctx.db.delete(entitlement._id)
    return null
  }
})

// CLI-only page of a fixture account's published subjects, for the proofs' cleanup and recovery.
export const listOwnedFixtureSubjects = internalQuery({
  args: {
    userId: v.string(),
    systemId: v.string(),
    subjectKind: zodToConvex(authoredSubjectKindSchema),
    paginationOpts: paginationOptsValidator
  },
  returns: v.object({
    page: v.array(v.object({ id: v.string(), label: v.string() })),
    continueCursor: v.string(),
    isDone: v.boolean()
  }),
  handler: async (ctx, { userId, systemId, subjectKind, paginationOpts }) => {
    await requireFixtureAccount(ctx, userId)
    const source = await ctx.db
      .query('contentSources')
      .withIndex('by_gameSystemId_kind_ownerUserId_code', (q) =>
        q
          .eq('gameSystemId', systemId)
          .eq('kind', 'USER')
          .eq('ownerUserId', userId)
          .eq('code', 'default')
      )
      .unique()
    if (!source) return { page: [], continueCursor: '', isDone: true }
    const { page, continueCursor, isDone } = await ctx.db
      .query('authoredRoots')
      .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
        q.eq('contentSourceId', source.id).eq('subjectKind', subjectKind).eq('ownerUserId', userId)
      )
      .paginate(paginationOpts)
    return { page: page.map(({ id, label }) => ({ id, label })), continueCursor, isDone }
  }
})

// CLI-only cleanup for the isolated publication proof, never an account/source deletion API.
export const removeEmptyFixtureSource = internalMutation({
  args: { userId: v.string(), systemId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, systemId }) => {
    await requireFixtureAccount(ctx, userId)
    const source = await ctx.db
      .query('contentSources')
      .withIndex('by_gameSystemId_kind_ownerUserId_code', (q) =>
        q
          .eq('gameSystemId', systemId)
          .eq('kind', 'USER')
          .eq('ownerUserId', userId)
          .eq('code', 'default')
      )
      .unique()
    if (!source) return null
    const [root, definition, counts, catalogues] = await Promise.all([
      ctx.db
        .query('authoredRoots')
        .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', source.id))
        .first(),
      ctx.db
        .query('reusableDefinitions')
        .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', source.id))
        .first(),
      ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) => q.eq('contentSourceId', source.id))
        .first(),
      ctx.db
        .query('rulesCatalogues')
        .withIndex('by_gameSystemId', (q) => q.eq('gameSystemId', systemId))
        .take(101)
    ])
    if (
      root ||
      definition ||
      counts ||
      catalogues.length > 100 ||
      catalogues.some((catalogue) => catalogue.contentSourceIds.includes(source.id))
    )
      throw new Error('Fixture source is still referenced.')
    await ctx.db.delete(source._id)
    return null
  }
})
