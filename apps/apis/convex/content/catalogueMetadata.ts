import {
  authoredCatalogueMetadataSchema,
  authoredCatalogueOwnerCountsSchema,
  type AuthoredCatalogueMetadata
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { syncAccountUsage } from '../lib/accountUsage'
import { requireSystem } from './systemDocuments'
import { isImportRowVisible } from '../imports/visibility'

export async function catalogueMetadata(
  ctx: QueryCtx,
  document: { label: string; description?: string | null; systemId?: string },
  identity: { checksum: string; publicId: string; createdAt: number }
): Promise<AuthoredCatalogueMetadata> {
  const spell =
    'kind' in document && document.kind === 'SPELL' ? spellAuthoredDtoSchema.parse(document) : null
  const magicSchool = spell
    ? (await requireSystem(ctx, spell.systemId)).magicSchools.find(
        (entry) => entry.id === spell.magicSchoolId
      )
    : null
  if (spell && !magicSchool) throw new Error('Spell magic school is not in the current System.')
  return authoredCatalogueMetadataSchema.parse({
    checksum: identity.checksum,
    publicId: identity.publicId,
    activeUpdatedAt: new Date(identity.createdAt).toISOString(),
    nameKey: document.label.toLowerCase(),
    description: document.description ?? null,
    ...('category' in document && typeof document.category === 'string'
      ? { category: document.category }
      : {}),
    ...('selectionMode' in document && typeof document.selectionMode === 'string'
      ? { selectionMode: document.selectionMode }
      : {}),
    ...(spell
      ? {
          spell: {
            selectionVersion: 1,
            publishedActive: spell.status === 'ACTIVE',
            ...(spell.attributes === undefined ? {} : { attributes: spell.attributes }),
            ...(spell.components === undefined ? {} : { components: spell.components }),
            ...(spell.materialDescription === undefined
              ? {}
              : { materialDescription: spell.materialDescription }),
            level: spell.level,
            magicSchoolId: spell.magicSchoolId,
            magicSchoolNameKey: magicSchool!.label.toLowerCase(),
            classIds: [...new Set(spell.classIds.map((id) => id.toLowerCase()))].sort(),
            castingTime: spell.castingTime
          }
        }
      : {}),
    countsVersion: 1,
    search: {
      version: 1,
      text: [
        document.label,
        document.description ?? '',
        'category' in document && typeof document.category === 'string' ? document.category : ''
      ]
        .filter(Boolean)
        .join(' ')
    }
  })
}

function validateOwnerCounts(counts: Doc<'authoredCatalogueOwnerCounts'>) {
  const { _id, _creationTime, ...stored } = counts
  return authoredCatalogueOwnerCountsSchema.parse(stored)
}

function updatedCategories(
  categories: { category: string; count: number }[],
  previousCategory: string | undefined,
  nextCategory: string | undefined
) {
  if (previousCategory === nextCategory) return categories
  const counts = new Map(categories.map(({ category, count }) => [category, count]))
  if (previousCategory) {
    const current = counts.get(previousCategory)
    if (!current || current < 1) throw new Error('Catalogue owner category count is missing.')
    if (current === 1) counts.delete(previousCategory)
    else counts.set(previousCategory, current - 1)
  }
  if (nextCategory) counts.set(nextCategory, (counts.get(nextCategory) ?? 0) + 1)
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) =>
      left.category < right.category ? -1 : left.category > right.category ? 1 : 0
    )
}

async function syncOwnerCounts(
  ctx: MutationCtx,
  root: Doc<'authoredRoots'>,
  metadata: AuthoredCatalogueMetadata
) {
  const previous = root.catalogue && authoredCatalogueMetadataSchema.parse(root.catalogue)
  const marked = previous?.countsVersion === 1
  const counts = await ctx.db
    .query('authoredCatalogueOwnerCounts')
    .withIndex('by_subjectKind_ownerUserId', (q) =>
      q.eq('subjectKind', root.subjectKind).eq('ownerUserId', root.ownerUserId)
    )
    .unique()
  if (!marked) {
    const markedRoot = await ctx.db
      .query('authoredRoots')
      .withIndex('by_kind_owner_countsVersion', (q) =>
        q
          .eq('subjectKind', root.subjectKind)
          .eq('ownerUserId', root.ownerUserId)
          .eq('catalogue.countsVersion', 1)
      )
      .first()
    if (Boolean(counts) !== Boolean(markedRoot))
      throw new Error('Catalogue owner membership integrity mismatch.')
    if (counts) {
      const parsed = validateOwnerCounts(counts)
      await ctx.db.patch(
        counts._id,
        authoredCatalogueOwnerCountsSchema.parse({
          ...parsed,
          count: parsed.count + 1,
          categories: updatedCategories(parsed.categories, undefined, metadata.category)
        })
      )
    } else {
      await ctx.db.insert('authoredCatalogueOwnerCounts', {
        subjectKind: root.subjectKind,
        ...(root.ownerUserId ? { ownerUserId: root.ownerUserId } : {}),
        count: 1,
        categories: metadata.category ? [{ category: metadata.category, count: 1 }] : []
      })
    }
    return
  }
  if (!counts) throw new Error('Catalogue owner count is missing.')
  const parsed = validateOwnerCounts(counts)
  const categories = updatedCategories(parsed.categories, previous?.category, metadata.category)
  if (categories !== parsed.categories) await ctx.db.patch(counts._id, { categories })
}

export async function removeCatalogueMetadata(ctx: MutationCtx, root: Doc<'authoredRoots'>) {
  if (root.subjectKind === 'SPELL') {
    const classes = await ctx.db
      .query('authoredSpellClasses')
      .withIndex('by_spellId', (q) => q.eq('spellId', root.id))
      .collect()
    for (const row of classes)
      if (await isImportRowVisible(ctx, row.importJobId)) await ctx.db.delete(row._id)
  }
  if (!root.catalogue) return
  const metadata = authoredCatalogueMetadataSchema.parse(root.catalogue)
  const sourceCounts = await ctx.db
    .query('authoredCatalogueCounts')
    .withIndex('by_source_kind', (q) =>
      q.eq('contentSourceId', root.contentSourceId).eq('subjectKind', root.subjectKind)
    )
    .unique()
  if (!sourceCounts || !Number.isSafeInteger(sourceCounts.count) || sourceCounts.count < 1)
    throw new Error('Catalogue count integrity mismatch.')
  if (metadata.countsVersion === 1) {
    const ownerCounts = await ctx.db
      .query('authoredCatalogueOwnerCounts')
      .withIndex('by_subjectKind_ownerUserId', (q) =>
        q.eq('subjectKind', root.subjectKind).eq('ownerUserId', root.ownerUserId)
      )
      .unique()
    if (!ownerCounts) throw new Error('Catalogue owner count is missing.')
    const parsed = validateOwnerCounts(ownerCounts)
    const categories = updatedCategories(parsed.categories, metadata.category, undefined)
    if (parsed.count === 1) await ctx.db.delete(ownerCounts._id)
    else await ctx.db.patch(ownerCounts._id, { count: parsed.count - 1, categories })
  }
  if (sourceCounts.count === 1) await ctx.db.delete(sourceCounts._id)
  else await ctx.db.patch(sourceCounts._id, { count: sourceCounts.count - 1 })
}

// Import and publication call this in their root/version transaction. The optional
// projection is also the backfill marker: exact replay must not count a root twice.
export async function syncCatalogueMetadata(
  ctx: MutationCtx,
  rootId: Id<'authoredRoots'>,
  metadata: AuthoredCatalogueMetadata
) {
  if (metadata.countsVersion !== 1)
    throw new Error('Catalogue owner membership marker is required.')
  const root = await ctx.db.get(rootId)
  if (!root || root.checksum !== metadata.checksum)
    throw new Error('Catalogue root identity mismatch.')
  // Same-document backfill retains server-created labels; republication replaces them.
  if (root.catalogue?.checksum === metadata.checksum && root.catalogue.deletedReferences)
    metadata = authoredCatalogueMetadataSchema.parse({
      ...metadata,
      deletedReferences: root.catalogue.deletedReferences
    })
  const counts = await ctx.db
    .query('authoredCatalogueCounts')
    .withIndex('by_source_kind', (q) =>
      q.eq('contentSourceId', root.contentSourceId).eq('subjectKind', root.subjectKind)
    )
    .unique()
  if (counts && (!Number.isSafeInteger(counts.count) || counts.count < 1))
    throw new Error('Catalogue count integrity mismatch.')
  if (root.catalogue) {
    if (!counts) throw new Error('Catalogue count is missing.')
  } else if (counts) {
    if (!Number.isSafeInteger(counts.count + 1))
      throw new Error('Catalogue count integrity mismatch.')
    await ctx.db.patch(counts._id, { count: counts.count + 1 })
  } else {
    await ctx.db.insert('authoredCatalogueCounts', {
      contentSourceId: root.contentSourceId,
      subjectKind: root.subjectKind,
      count: 1
    })
  }
  await syncOwnerCounts(ctx, root, metadata)
  if (root.subjectKind === 'SPELL') {
    if (!metadata.spell) throw new Error('Spell catalogue metadata is required.')
    const classes = await ctx.db
      .query('authoredSpellClasses')
      .withIndex('by_spellId', (q) => q.eq('spellId', root.id))
      .collect()
    for (const row of classes)
      if (await isImportRowVisible(ctx, row.importJobId)) await ctx.db.delete(row._id)
    for (const classId of metadata.spell.classIds) {
      await ctx.db.insert('authoredSpellClasses', { spellId: root.id, classId })
    }
  }
  await ctx.db.patch(root._id, {
    catalogue: authoredCatalogueMetadataSchema.parse(metadata),
    spellClassesIndexed: root.subjectKind === 'SPELL' ? true : undefined
  })
  await syncAccountUsage(ctx, 'homebrewRoots', root.id)
}
