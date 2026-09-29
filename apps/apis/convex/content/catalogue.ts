import * as zMini from 'zod/mini'
import { mergedStream } from 'convex-helpers/server/stream'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredCatalogueCountsSchema,
  authoredCatalogueMetadataSchema,
  authoredCatalogueOwnerCountsSchema,
  authoredCataloguePageSchema,
  authoredCatalogueReadInputSchema,
  authoredCatalogueSearchInputSchema,
  authoredCatalogueSummaryInputSchema,
  authoredCatalogueSummarySchema,
  authoredCatalogueScopeSchema,
  type AuthoredCataloguePage,
  type AuthoredCatalogueReadInput,
  type AuthoredCatalogueScope,
  type AuthoredCatalogueSummary
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { memoizeTransactionReads } from '@artificer-toolkit/encounter-persistence/transactionReads'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import type { Doc } from '../_generated/dataModel'
import { contentStream } from './streams'
import { getAuthenticatedProfile } from '../lib/identity'
import { readAuthoringSources } from './sources'
import { catalogueItem, spellDisplay } from './catalogueItem'
import { isImportRowVisible } from '../imports/visibility'

function requireSupportedCategory(
  input: Pick<AuthoredCatalogueReadInput, 'subjectKind' | 'category' | 'sort'>
) {
  if (
    (input.category || input.sort === 'category') &&
    ['BACKGROUND', 'FEAT', 'SPELL'].includes(input.subjectKind)
  )
    throw new Error('Catalogue category filtering is not supported for this subject kind.')
}

function requireSupportedSpell(input: {
  subjectKind: AuthoredCatalogueScope['subjectKind']
  classId?: string
  level?: number
  magicSchoolId?: string
  sort?: AuthoredCatalogueReadInput['sort']
}) {
  if (
    input.subjectKind !== 'SPELL' &&
    (input.classId !== undefined ||
      input.level !== undefined ||
      input.magicSchoolId !== undefined ||
      input.sort === 'level' ||
      input.sort === 'school')
  )
    throw new Error('Spell filtering and sorting are only supported for Spells.')
}

function matchesSpellFilters(
  root: Doc<'authoredRoots'>,
  input: Pick<AuthoredCatalogueReadInput, 'subjectKind' | 'classId' | 'level' | 'magicSchoolId'>
) {
  if (input.subjectKind !== 'SPELL') return true
  const spell = authoredCatalogueMetadataSchema.parse(root.catalogue).spell
  if (!spell) throw new Error('Spell catalogue metadata backfill is incomplete.')
  return (
    (input.classId === undefined || spell.classIds.includes(input.classId)) &&
    (input.level === undefined || spell.level === input.level) &&
    (input.magicSchoolId === undefined || spell.magicSchoolId === input.magicSchoolId)
  )
}

async function requireCompleteCatalogue(
  ctx: QueryCtx,
  input: Pick<AuthoredCatalogueReadInput, 'subjectKind' | 'systemId'>,
  owners: (string | undefined)[]
) {
  for (const owner of owners) {
    const roots = ctx.db.query('authoredRoots')
    const systemId = input.systemId
    const missing = systemId
      ? roots
          .withIndex('by_system_kind_owner_name_id', (q) =>
            q
              .eq('systemId', systemId)
              .eq('subjectKind', input.subjectKind)
              .eq('ownerUserId', owner)
              .eq('catalogue.nameKey', undefined)
          )
          .first()
      : roots
          .withIndex('by_kind_owner_name_id', (q) =>
            q
              .eq('subjectKind', input.subjectKind)
              .eq('ownerUserId', owner)
              .eq('catalogue.nameKey', undefined)
          )
          .first()
    if (await missing) throw new Error('Catalogue metadata backfill is incomplete.')
    if (input.subjectKind === 'SPELL') {
      const missingSpell = systemId
        ? roots
            .withIndex('by_system_kind_owner_spellLevel_name_id', (q) =>
              q
                .eq('systemId', systemId)
                .eq('subjectKind', 'SPELL')
                .eq('ownerUserId', owner)
                .eq('catalogue.spell.level', undefined)
            )
            .first()
        : roots
            .withIndex('by_kind_owner_spellLevel_name_id', (q) =>
              q
                .eq('subjectKind', 'SPELL')
                .eq('ownerUserId', owner)
                .eq('catalogue.spell.level', undefined)
            )
            .first()
      if (await missingSpell) throw new Error('Spell catalogue metadata backfill is incomplete.')
    }
  }
}

async function requireCompleteSearchCatalogue(
  ctx: QueryCtx,
  input: {
    subjectKind: AuthoredCatalogueScope['subjectKind']
    systemId?: string
  },
  owner: string | undefined
) {
  if (
    await ctx.db
      .query('authoredRoots')
      .withIndex('by_kind_owner_searchVersion_system', (q) => {
        const indexed = q
          .eq('subjectKind', input.subjectKind)
          .eq('ownerUserId', owner)
          .eq('catalogue.search.version', undefined)
        return input.systemId ? indexed.eq('systemId', input.systemId) : indexed
      })
      .first()
  )
    throw new Error('Catalogue search metadata backfill is incomplete.')
}

async function readOwnerCatalogueCounts(
  ctx: QueryCtx,
  subjectKind: AuthoredCatalogueScope['subjectKind'],
  ownerUserId: string | undefined
) {
  const missing = await ctx.db
    .query('authoredRoots')
    .withIndex('by_kind_owner_countsVersion', (q) =>
      q
        .eq('subjectKind', subjectKind)
        .eq('ownerUserId', ownerUserId)
        .eq('catalogue.countsVersion', undefined)
    )
    .first()
  if (missing) throw new Error('Catalogue owner totals backfill is incomplete.')
  const counts = await ctx.db
    .query('authoredCatalogueOwnerCounts')
    .withIndex('by_subjectKind_ownerUserId', (q) =>
      q.eq('subjectKind', subjectKind).eq('ownerUserId', ownerUserId)
    )
    .unique()
  if (!counts) {
    const marked = await ctx.db
      .query('authoredRoots')
      .withIndex('by_kind_owner_countsVersion', (q) =>
        q
          .eq('subjectKind', subjectKind)
          .eq('ownerUserId', ownerUserId)
          .eq('catalogue.countsVersion', 1)
      )
      .first()
    if (marked) throw new Error('Catalogue owner count is missing.')
    return null
  }
  const { _id, _creationTime, ...stored } = counts
  return authoredCatalogueOwnerCountsSchema.parse(stored)
}

async function readSpellSummaryRows(
  ctx: QueryCtx,
  ownerUserId: string | undefined,
  userId: string | null
) {
  // ponytail: bounded scan; materialize facet counts if an owner exceeds 500 active Spells.
  const rows = await contentStream(ctx.db)
    .query('authoredRoots')
    .withIndex('by_kind_owner_name_id', (q) =>
      q.eq('subjectKind', 'SPELL').eq('ownerUserId', ownerUserId)
    )
    .filterWith((root) => isImportRowVisible(ctx, root.importJobId))
    .take(501)
  if (rows.length > 500) throw new Error('Spell catalogue facet scan exceeds 500 active Spells.')
  return Promise.all(
    rows.map(async (root) => {
      const metadata = authoredCatalogueMetadataSchema.parse(root.catalogue)
      const spell = await spellDisplay(ctx, root, userId, metadata)
      return { root, spell }
    })
  )
}

export const list = query({
  args: zodToConvexFields(authoredCatalogueReadInputSchema.shape),
  returns: zodToConvex(authoredCataloguePageSchema),
  handler: async (transaction, args): Promise<AuthoredCataloguePage> => {
    // Rows share one System, one Source and a few Class roots; each is read once, not once per row.
    const ctx: QueryCtx = { ...transaction, db: memoizeTransactionReads(transaction.db) }
    const input = authoredCatalogueReadInputSchema.parse(args)
    requireSupportedCategory(input)
    requireSupportedSpell(input)
    if (input.sort === 'family' && input.subjectKind !== 'CLASS' && input.subjectKind !== 'RACE')
      throw new Error('Catalogue family sorting is not supported for this subject kind.')
    const userId = (await getAuthenticatedProfile(ctx))?.identity.userId ?? null
    const owners: (string | undefined)[] = [
      ...(input.source !== 'OWNED' ? [undefined] : []),
      ...(input.source !== 'MASTER' && userId ? [userId] : [])
    ]
    if (owners.length === 0) return { page: [], isDone: true, continueCursor: '' }
    await requireCompleteCatalogue(ctx, input, owners)
    // At most two stream heads, regardless of the number of an author's sources.
    const systemId = input.systemId
    if (input.sort === 'family') {
      for (const owner of owners) {
        const roots = ctx.db.query('authoredRoots')
        const category = input.category
        const missing = category
          ? systemId
            ? roots.withIndex('by_system_kind_owner_category_family_name_id', (q) =>
                q
                  .eq('systemId', systemId)
                  .eq('subjectKind', input.subjectKind)
                  .eq('ownerUserId', owner)
                  .eq('catalogue.category', category)
                  .eq('catalogueFamily.nameKey', undefined)
              )
            : roots.withIndex('by_kind_owner_category_family_name_id', (q) =>
                q
                  .eq('subjectKind', input.subjectKind)
                  .eq('ownerUserId', owner)
                  .eq('catalogue.category', category)
                  .eq('catalogueFamily.nameKey', undefined)
              )
          : systemId
            ? roots.withIndex('by_system_kind_owner_family_name_id', (q) =>
                q
                  .eq('systemId', systemId)
                  .eq('subjectKind', input.subjectKind)
                  .eq('ownerUserId', owner)
                  .eq('catalogueFamily.nameKey', undefined)
              )
            : roots.withIndex('by_kind_owner_family_name_id', (q) =>
                q
                  .eq('subjectKind', input.subjectKind)
                  .eq('ownerUserId', owner)
                  .eq('catalogueFamily.nameKey', undefined)
              )
        if (await missing.first()) throw new Error('Catalogue family backfill is incomplete.')
      }
    }
    const ranges = owners.map((owner) => {
      const roots = contentStream(ctx.db).query('authoredRoots')
      if (input.subjectKind === 'SPELL' && input.sort === 'level')
        return systemId
          ? roots.withIndex('by_system_kind_owner_spellLevel_name_id', (q) =>
              q.eq('systemId', systemId).eq('subjectKind', 'SPELL').eq('ownerUserId', owner)
            )
          : roots.withIndex('by_kind_owner_spellLevel_name_id', (q) =>
              q.eq('subjectKind', 'SPELL').eq('ownerUserId', owner)
            )
      if (input.subjectKind === 'SPELL' && input.sort === 'school')
        return systemId
          ? roots.withIndex('by_system_kind_owner_spellSchool_name_id', (q) =>
              q.eq('systemId', systemId).eq('subjectKind', 'SPELL').eq('ownerUserId', owner)
            )
          : roots.withIndex('by_kind_owner_spellSchool_name_id', (q) =>
              q.eq('subjectKind', 'SPELL').eq('ownerUserId', owner)
            )
      if (input.sort === 'family') {
        const category = input.category
        if (category)
          return systemId
            ? roots.withIndex('by_system_kind_owner_category_family_name_id', (q) =>
                q
                  .eq('systemId', systemId)
                  .eq('subjectKind', input.subjectKind)
                  .eq('ownerUserId', owner)
                  .eq('catalogue.category', category)
              )
            : roots.withIndex('by_kind_owner_category_family_name_id', (q) =>
                q
                  .eq('subjectKind', input.subjectKind)
                  .eq('ownerUserId', owner)
                  .eq('catalogue.category', category)
              )
        return systemId
          ? roots.withIndex('by_system_kind_owner_family_name_id', (q) =>
              q
                .eq('systemId', systemId)
                .eq('subjectKind', input.subjectKind)
                .eq('ownerUserId', owner)
            )
          : roots.withIndex('by_kind_owner_family_name_id', (q) =>
              q.eq('subjectKind', input.subjectKind).eq('ownerUserId', owner)
            )
      }
      if (input.category || input.sort === 'category') {
        return systemId
          ? roots.withIndex('by_system_kind_owner_category_name_id', (q) => {
              const scoped = q
                .eq('systemId', systemId)
                .eq('subjectKind', input.subjectKind)
                .eq('ownerUserId', owner)
              return input.category ? scoped.eq('catalogue.category', input.category) : scoped
            })
          : roots.withIndex('by_kind_owner_category_name_id', (q) => {
              const scoped = q.eq('subjectKind', input.subjectKind).eq('ownerUserId', owner)
              return input.category ? scoped.eq('catalogue.category', input.category) : scoped
            })
      }
      return systemId
        ? roots.withIndex('by_system_kind_owner_name_id', (q) =>
            q.eq('systemId', systemId).eq('subjectKind', input.subjectKind).eq('ownerUserId', owner)
          )
        : roots.withIndex('by_kind_owner_name_id', (q) =>
            q.eq('subjectKind', input.subjectKind).eq('ownerUserId', owner)
          )
    })
    // Access is selected by index before merging. Never filter private roots out
    // of a stream: its continuation cursor includes the visited index keys.
    const result = await mergedStream(
      ranges,
      input.sort === 'level'
        ? ['catalogue.spell.level', 'catalogue.nameKey', 'id']
        : input.sort === 'school'
          ? ['catalogue.spell.magicSchoolNameKey', 'catalogue.nameKey', 'id']
          : input.sort === 'family'
            ? input.category
              ? ['catalogueFamily.nameKey', 'catalogueFamily.id', 'catalogue.nameKey', 'id']
              : [
                  'catalogueFamily.nameKey',
                  'catalogueFamily.id',
                  'catalogue.category',
                  'catalogue.nameKey',
                  'id'
                ]
            : input.sort === 'category' && !input.category
              ? ['catalogue.category', 'catalogue.nameKey', 'id']
              : ['catalogue.nameKey', 'id']
    )
      .filterWith(
        async (root) =>
          (await isImportRowVisible(ctx, root.importJobId)) && matchesSpellFilters(root, input)
      )
      .map((root) => catalogueItem(ctx, root, userId, input.source, false, input.sort === 'family'))
      // Above the single-document ceiling: one valid row must not request
      // reactive splitting forever. Only two stream heads can prefetch.
      .paginate({
        ...input.paginationOpts,
        maximumRowsRead: 96,
        maximumBytesRead: 2 * 1024 * 1024
      })
    return authoredCataloguePageSchema.parse(result)
  }
})

export const search = query({
  args: zodToConvexFields(authoredCatalogueSearchInputSchema.shape),
  returns: zodToConvex(authoredCataloguePageSchema),
  handler: async (transaction, args): Promise<AuthoredCataloguePage> => {
    const ctx: QueryCtx = { ...transaction, db: memoizeTransactionReads(transaction.db) }
    const input = authoredCatalogueSearchInputSchema.parse(args)
    requireSupportedCategory(input)
    const userId = (await getAuthenticatedProfile(ctx))?.identity.userId ?? null
    const owner = input.source === 'MASTER' ? undefined : userId
    if (owner === null) return { page: [], isDone: true, continueCursor: '' }
    await requireCompleteSearchCatalogue(ctx, input, owner)
    const search = ctx.db.query('authoredRoots').withSearchIndex('search_catalogue', (q) => {
      const filtered = q
        .search('catalogue.search.text', input.query)
        .eq('subjectKind', input.subjectKind)
        .eq('ownerUserId', owner)
      const systemFiltered = input.systemId ? filtered.eq('systemId', input.systemId) : filtered
      return input.category
        ? systemFiltered.eq('catalogue.category', input.category)
        : systemFiltered
    })
    const result = await search.paginate({
      ...input.paginationOpts,
      maximumRowsRead: 96,
      maximumBytesRead: 2 * 1024 * 1024
    })
    return authoredCataloguePageSchema.parse({
      ...result,
      page: await Promise.all(
        (
          await Promise.all(
            result.page.map(async (root) =>
              (await isImportRowVisible(ctx, root.importJobId)) ? root : null
            )
          )
        )
          .filter((root): root is Doc<'authoredRoots'> => root !== null)
          .map((root) => catalogueItem(ctx, root, userId, input.source, true))
      )
    })
  }
})

export const summary = query({
  args: zodToConvexFields(authoredCatalogueSummaryInputSchema.shape),
  returns: zodToConvex(authoredCatalogueSummarySchema),
  handler: async (transaction, args): Promise<AuthoredCatalogueSummary> => {
    const ctx: QueryCtx = { ...transaction, db: memoizeTransactionReads(transaction.db) }
    const input = authoredCatalogueSummaryInputSchema.parse(args)
    requireSupportedCategory(input)
    requireSupportedSpell(input)
    const userId = (await getAuthenticatedProfile(ctx))?.identity.userId
    const master = await readOwnerCatalogueCounts(ctx, input.subjectKind, undefined)
    const owned = userId ? await readOwnerCatalogueCounts(ctx, input.subjectKind, userId) : null
    const masterCount = master?.count ?? 0
    const ownedCount = owned?.count ?? 0
    if (input.subjectKind === 'SPELL') {
      const owners: (string | undefined)[] = [undefined, ...(userId ? [userId] : [])]
      await requireCompleteCatalogue(ctx, input, owners)
      const rowsByOwner = await Promise.all(
        owners.map((owner) => readSpellSummaryRows(ctx, owner, userId ?? null))
      )
      const visible = rowsByOwner.flat()
      const selectedRows = visible.filter(({ root }) =>
        input.source === 'MASTER'
          ? root.ownerUserId === undefined
          : input.source === 'OWNED'
            ? Boolean(userId && root.ownerUserId === userId)
            : true
      )
      const classes = new Map<string, string>()
      const schools = new Map<string, string>()
      const levels = new Set<number>()
      for (const { spell } of visible) {
        spell.classIds.forEach((id, index) => classes.set(id, spell.classLabels[index]!))
        schools.set(spell.magicSchoolId, spell.magicSchoolLabel)
        levels.add(spell.level)
      }
      return authoredCatalogueSummarySchema.parse({
        activeCount: masterCount + ownedCount,
        masterCount,
        ownedCount,
        totalCount: selectedRows.filter(({ root }) => matchesSpellFilters(root, input)).length,
        categories: [],
        spellFacets: {
          classes: [...classes.entries()]
            .map(([id, label]) => ({ id, label }))
            .sort(
              (left, right) =>
                left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
            ),
          schools: [...schools.entries()]
            .map(([id, label]) => ({ id, label }))
            .sort(
              (left, right) =>
                left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
            ),
          levels: [...levels].sort((left, right) => left - right).map((id) => ({ id }))
        }
      })
    }
    const selected = [
      ...(input.source !== 'OWNED' ? [master] : []),
      ...(input.source !== 'MASTER' && userId ? [owned] : [])
    ].filter((row): row is NonNullable<typeof row> => row !== null)
    const totalCount = input.category
      ? selected.reduce(
          (total, row) =>
            total + (row.categories.find((entry) => entry.category === input.category)?.count ?? 0),
          0
        )
      : selected.reduce((total, row) => total + row.count, 0)
    const categories = [
      ...new Set(
        [...(master?.categories ?? []), ...(owned?.categories ?? [])].map((entry) => entry.category)
      )
    ].sort()
    return authoredCatalogueSummarySchema.parse({
      activeCount: masterCount + ownedCount,
      masterCount,
      ownedCount,
      totalCount,
      categories
    })
  }
})

export const counts = query({
  args: zodToConvexFields(zMini.omit(authoredCatalogueScopeSchema, { source: true }).shape),
  returns: zodToConvex(authoredCatalogueCountsSchema),
  handler: async (ctx, args) => {
    const input = zMini.omit(authoredCatalogueScopeSchema, { source: true }).parse(args)
    const userId = (await getAuthenticatedProfile(ctx))?.identity.userId ?? null
    const sources = await readAuthoringSources(ctx, input.systemId, userId)
    await requireCompleteCatalogue(ctx, input, userId ? [undefined, userId] : [undefined])
    let masterCount = 0
    let ownedCount = 0
    for (const source of sources) {
      const counts = await ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) =>
          q.eq('contentSourceId', source.id).eq('subjectKind', input.subjectKind)
        )
        .unique()
      const count = counts?.count ?? 0
      if (
        !counts &&
        (await ctx.db
          .query('authoredRoots')
          .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
            q
              .eq('contentSourceId', source.id)
              .eq('subjectKind', input.subjectKind)
              .eq('ownerUserId', source.kind === 'USER' ? source.ownerUserId : undefined)
          )
          .first())
      )
        throw new Error('Catalogue counts are not materialized.')
      if (!Number.isSafeInteger(count) || count < 0)
        throw new Error('Catalogue count integrity mismatch.')
      if (source.kind === 'PLATFORM') masterCount += count
      else ownedCount += count
    }
    return authoredCatalogueCountsSchema.parse({
      activeCount: masterCount + ownedCount,
      masterCount,
      ownedCount
    })
  }
})
