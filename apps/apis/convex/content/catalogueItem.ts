import {
  authoredCatalogueMetadataSchema,
  authoredCatalogueOptionSchema
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readCatalogueParent } from './catalogueFamilies'
import { canReadAuthoredRoot } from './documents'
import { requireSystem } from './systemDocuments'

export async function spellDisplay(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  userId: string | null,
  metadata: ReturnType<typeof authoredCatalogueMetadataSchema.parse>
) {
  const spell = metadata.spell
  if (!spell) throw new Error('Spell catalogue metadata backfill is incomplete.')
  const system = await requireSystem(ctx, root.systemId)
  const school = system.magicSchools.find((entry) => entry.id === spell.magicSchoolId)
  if (!school || school.label.toLowerCase() !== spell.magicSchoolNameKey)
    throw new Error('Spell catalogue metadata is stale.')
  const classLabels = await Promise.all(
    spell.classIds.map(async (id) => {
      const classRoot = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
      if (!classRoot) {
        const retained = metadata.deletedReferences?.find(
          (entry) => entry.subjectKind === 'CLASS' && entry.subjectId === id
        )
        if (retained) return retained.label
      }
      if (
        !classRoot ||
        classRoot.subjectKind !== 'CLASS' ||
        classRoot.systemId !== root.systemId ||
        !(await canReadAuthoredRoot(ctx, classRoot, userId))
      )
        throw new Error('Spell Class catalogue metadata is stale.')
      return classRoot.label
    })
  )
  return {
    classIds: spell.classIds,
    classLabels,
    level: spell.level,
    magicSchoolId: spell.magicSchoolId,
    magicSchoolLabel: school.label,
    castingTimeUnit: spell.castingTime.unit,
    castingTimeAmount: spell.castingTime.amount
  }
}

export async function catalogueItem(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  userId: string | null,
  sourceKind: 'MASTER' | 'OWNED' | undefined,
  searched: boolean,
  familyOrdered = false
) {
  const source = await ctx.db
    .query('contentSources')
    .withIndex('by_publicId', (q) => q.eq('id', root.contentSourceId))
    .unique()
  if (
    !source ||
    root.systemId !== source.gameSystemId ||
    root.ownerUserId !== (source.kind === 'USER' ? source.ownerUserId : undefined) ||
    (sourceKind === 'MASTER'
      ? source.kind !== 'PLATFORM' || source.ownerUserId !== null
      : sourceKind === 'OWNED' && (source.kind !== 'USER' || source.ownerUserId !== userId))
  )
    throw new Error('Catalogue source identity mismatch.')
  const metadata = authoredCatalogueMetadataSchema.parse(root.catalogue)
  if (
    metadata.checksum !== root.checksum ||
    metadata.nameKey !== root.label.toLowerCase() ||
    (searched &&
      (metadata.search?.version !== 1 ||
        metadata.search.text !==
          [root.label, metadata.description ?? '', metadata.category ?? '']
            .filter(Boolean)
            .join(' ')))
  )
    throw new Error('Catalogue metadata is stale.')
  if (root.subjectKind !== 'SPELL' && metadata.spell !== undefined)
    throw new Error('Catalogue Spell metadata is invalid.')
  const spell =
    root.subjectKind === 'SPELL' ? await spellDisplay(ctx, root, userId, metadata) : null
  const parent =
    root.subjectKind === 'CLASS' || root.subjectKind === 'RACE'
      ? await readCatalogueParent(ctx, root, userId)
      : null
  if (
    root.subjectKind === 'RACE' &&
    (metadata.category === 'BASE'
      ? metadata.selectionMode === undefined
      : metadata.selectionMode !== undefined)
  )
    throw new Error('Catalogue Race selection metadata is invalid.')
  if (
    familyOrdered &&
    (root.catalogueFamily?.id !== (parent?.id ?? root.id) ||
      root.catalogueFamily?.nameKey !== (parent?.label ?? root.label).toLowerCase())
  )
    throw new Error('Catalogue family projection mismatch.')
  const owned = root.ownerUserId !== undefined
  return authoredCatalogueOptionSchema.parse({
    id: root.id,
    publicId: metadata.publicId,
    systemId: root.systemId,
    label: root.label,
    description: metadata.description,
    ...(metadata.category ? { category: metadata.category } : {}),
    ...(parent
      ? root.subjectKind === 'CLASS'
        ? { parentClassId: parent.id, parentClassLabel: parent.label }
        : { parentRaceId: parent.id, parentRaceLabel: parent.label }
      : {}),
    ...(root.subjectKind === 'RACE' && metadata.selectionMode
      ? { selectionMode: metadata.selectionMode }
      : {}),
    ...(spell ?? {}),
    activeUpdatedAt: metadata.activeUpdatedAt,
    status: 'ACTIVE',
    provenance: { kind: owned ? 'OWNED' : 'MASTER', ownerUserId: root.ownerUserId ?? null },
    permissions: { canView: true, canEdit: owned, canCopy: userId !== null, canDelete: owned }
  })
}
