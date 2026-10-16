import { authoredCatalogueMetadataSchema } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { canReadAuthoredRoot } from './documents'
import { assertClassRelationshipsIndexed } from './classRelationshipIndex'

export async function readCatalogueParent(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  userId: string | null
) {
  if (root.subjectKind !== 'CLASS' && root.subjectKind !== 'RACE')
    throw new Error('Catalogue family relationships are not supported for this subject kind.')
  const kind = root.subjectKind === 'CLASS' ? 'Class' : 'Race'
  const childCategory = root.subjectKind === 'CLASS' ? 'SUBCLASS' : 'SUBRACE'
  const parentId = root.subjectKind === 'CLASS' ? root.parentClassId : root.parentRaceId
  const metadata = authoredCatalogueMetadataSchema.parse(root.catalogue)
  if (
    metadata.checksum !== root.checksum ||
    metadata.nameKey !== root.label.toLowerCase() ||
    (metadata.category !== 'BASE' && metadata.category !== childCategory)
  )
    throw new Error(`Catalogue ${kind} metadata is stale.`)
  if (
    (metadata.category === 'BASE' && parentId !== null) ||
    (metadata.category === childCategory && (!parentId || parentId === root.id))
  )
    throw new Error(`Catalogue ${kind} parent projection is invalid.`)
  if (!parentId) return null
  const parent = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', parentId))
    .unique()
  if (!parent) {
    const retained = metadata.deletedReferences?.find(
      (entry) => entry.subjectKind === root.subjectKind && entry.subjectId === parentId
    )
    if (retained) return { id: retained.subjectId, label: retained.label }
  }
  if (!parent || parent.subjectKind !== root.subjectKind || parent.systemId !== root.systemId)
    throw new Error(`Catalogue ${kind.toLowerCase()} parent is invalid.`)
  if (!(await canReadAuthoredRoot(ctx, parent, userId)))
    throw new Error(`Catalogue ${kind.toLowerCase()} parent is not visible.`)
  const parentMetadata = authoredCatalogueMetadataSchema.parse(parent.catalogue)
  if (
    parentMetadata.checksum !== parent.checksum ||
    parentMetadata.nameKey !== parent.label.toLowerCase() ||
    parentMetadata.category !== 'BASE' ||
    (root.subjectKind === 'CLASS' ? parent.parentClassId : parent.parentRaceId) !== null
  )
    throw new Error(`Catalogue ${kind.toLowerCase()} parent metadata is stale.`)
  return parent
}

// Called only after the canonical document/relationship has been verified by its replay path.
export async function backfillCatalogueFamily(ctx: MutationCtx, root: Doc<'authoredRoots'>) {
  const parent = await readCatalogueParent(ctx, root, root.ownerUserId ?? null)
  const family = { id: parent?.id ?? root.id, nameKey: (parent?.label ?? root.label).toLowerCase() }
  if (root.catalogueFamily) {
    if (root.catalogueFamily.id !== family.id || root.catalogueFamily.nameKey !== family.nameKey)
      throw new Error('Catalogue family projection mismatch.')
  } else await ctx.db.patch(root._id, { catalogueFamily: family })
}

export async function publishClassCatalogueFamily(
  ctx: MutationCtx,
  root: Doc<'authoredRoots'>,
  previousLabel: string | undefined,
  userId: string | null
) {
  const parent = await readCatalogueParent(ctx, root, userId)
  const family = { id: parent?.id ?? root.id, nameKey: (parent?.label ?? root.label).toLowerCase() }
  await ctx.db.patch(root._id, { catalogueFamily: family })
  if (parent || previousLabel?.toLowerCase() === root.label.toLowerCase()) return
  await assertClassRelationshipsIndexed(ctx, root.systemId)
  const children = await ctx.db
    .query('authoredRoots')
    .withIndex('by_system_kind_parentClassId', (q) =>
      q.eq('systemId', root.systemId).eq('subjectKind', 'CLASS').eq('parentClassId', root.id)
    )
    .take(500)
  if (children.length >= 500)
    throw new Error('Class family exceeds the 500-record authoring limit.')
  for (const child of children) {
    if (
      child.ownerUserId !== (userId ?? undefined) ||
      !(await canReadAuthoredRoot(ctx, child, userId))
    )
      throw new Error('Class dependent ownership mismatch.')
    await readCatalogueParent(ctx, child, userId)
    // Only read ordering changes. UUID references, authored versions and drafts remain untouched.
    await ctx.db.patch(child._id, { catalogueFamily: family })
  }
}
