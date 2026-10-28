import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredCatalogueMetadataSchema,
  authoredCatalogueSearchBackfillInputSchema,
  authoredCatalogueSearchBackfillResultSchema
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { internalMutation } from '../lib/mutations'
import { catalogueMetadata, syncCatalogueMetadata } from './catalogueMetadata'
import { canReadAuthoredRoot, readAuthoredVersion, readPublishedDocument } from './documents'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { requireClassParent } from './classRelationships'
import { requireRaceParent } from './raceRelationships'
import { backfillCatalogueFamily } from './catalogueFamilies'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { resolveCurrentEquipment } from './equipmentRelationships'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'

function exactEquipmentOptionFacts(actual: unknown, expected: unknown) {
  if (canonicalizeRuleDocument(actual) !== canonicalizeRuleDocument(expected))
    throw new Error('Catalogue Equipment option facts mismatch.')
}

export const backfill = internalMutation({
  args: zodToConvexFields(authoredCatalogueSearchBackfillInputSchema.shape),
  returns: zodToConvex(authoredCatalogueSearchBackfillResultSchema),
  handler: async (ctx, args) => {
    const input = authoredCatalogueSearchBackfillInputSchema.parse(args)
    const result = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId')
      .paginate({
        ...input.paginationOpts,
        // Each root can hydrate a version, source, route, and Class parent; leave transaction headroom.
        maximumRowsRead: 2,
        maximumBytesRead: 1024 * 1024
      })
    for (const root of result.page) {
      if (!(await canReadAuthoredRoot(ctx, root, root.ownerUserId ?? null)))
        throw new Error('Catalogue backfill source identity mismatch.')
      const version = await readAuthoredVersion(ctx, root)
      const document = await readPublishedDocument(ctx, root, version)
      if (
        document.id !== root.id ||
        document.systemId !== root.systemId ||
        document.label !== root.label
      )
        throw new Error('Catalogue backfill document identity mismatch.')
      const route = await ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', root.id))
        .unique()
      if (!route || route.subjectKind !== root.subjectKind)
        throw new Error('Catalogue backfill route mismatch.')
      if (root.subjectKind === 'CLASS') {
        const authored = classAuthoredDtoSchema.parse(document)
        const expectedParentId = authored.category === 'SUBCLASS' ? authored.parentClassId : null
        if (root.parentClassId !== expectedParentId)
          throw new Error('Catalogue Class parent projection mismatch.')
        if (authored.category === 'SUBCLASS')
          await requireClassParent(ctx, authored, root.ownerUserId ?? null)
      }
      if (root.subjectKind === 'RACE') {
        const authored = raceAuthoredDtoSchema.parse(document)
        const expectedParentId = authored.category === 'SUBRACE' ? authored.parentRaceId : null
        if (root.parentRaceId !== expectedParentId)
          throw new Error('Catalogue Race parent projection mismatch.')
        if (authored.category === 'SUBRACE')
          await requireRaceParent(ctx, authored, root.ownerUserId ?? null)
      }
      if (root.subjectKind === 'EQUIPMENT') {
        const authored = equipmentAuthoredDtoSchema.parse(document)
        const parentEquipmentId =
          authored.category === 'VARIANT' ? authored.parentEquipmentId : null
        if (root.parentEquipmentId !== parentEquipmentId)
          throw new Error('Catalogue Equipment parent projection mismatch.')
        if (!root.equipmentOptions) throw new Error('Equipment option facts are not materialized.')
        const { effective } = await resolveCurrentEquipment(ctx, authored, root.ownerUserId ?? null)
        const rawFacts = equipmentOptionFacts(authored, root.checksum)
        const expectedFacts = equipmentOptionFacts(authored, root.checksum, effective)
        if (root.equipmentOptions.builder === undefined) {
          exactEquipmentOptionFacts(root.equipmentOptions, rawFacts)
          await ctx.db.patch(root._id, { equipmentOptions: expectedFacts })
        } else exactEquipmentOptionFacts(root.equipmentOptions, expectedFacts)
      }
      const metadata = await catalogueMetadata(
        ctx,
        {
          subjectKind: root.subjectKind,
          document: { ...document, label: root.label, systemId: root.systemId }
        },
        {
          checksum: root.checksum,
          publicId: route.publicId,
          createdAt: version._creationTime
        }
      )
      if (root.catalogue) {
        const existing = authoredCatalogueMetadataSchema.parse(root.catalogue)
        if (
          canonicalizeRuleDocument({
            ...existing,
            search: existing.search ?? metadata.search,
            countsVersion: existing.countsVersion ?? metadata.countsVersion,
            publishedActive: existing.publishedActive ?? metadata.publishedActive,
            ...(metadata.race !== undefined ? { race: existing.race ?? metadata.race } : {}),
            ...(metadata.class !== undefined ? { class: existing.class ?? metadata.class } : {}),
            ...(metadata.background !== undefined
              ? { background: existing.background ?? metadata.background }
              : {}),
            ...(metadata.selectionMode !== undefined
              ? {
                  selectionMode: existing.selectionMode ?? metadata.selectionMode
                }
              : {}),
            ...(metadata.spell !== undefined
              ? {
                  spell: existing.spell
                    ? existing.spell.selectionVersion === 1
                      ? existing.spell
                      : { ...metadata.spell, ...existing.spell }
                    : metadata.spell
                }
              : {})
          }) !==
          canonicalizeRuleDocument({
            ...metadata,
            ...(existing.deletedReferences ? { deletedReferences: existing.deletedReferences } : {})
          })
        )
          throw new Error('Catalogue backfill metadata mismatch.')
        if (
          existing.search === undefined ||
          existing.countsVersion === undefined ||
          (metadata.selectionMode !== undefined && existing.selectionMode === undefined) ||
          (metadata.spell !== undefined && existing.spell === undefined) ||
          (metadata.spell !== undefined && existing.spell?.selectionVersion !== 1) ||
          existing.publishedActive === undefined ||
          (metadata.race !== undefined && existing.race === undefined) ||
          (metadata.class !== undefined && existing.class === undefined) ||
          (metadata.background !== undefined && existing.background === undefined) ||
          (root.subjectKind === 'SPELL' && root.spellClassesIndexed !== true)
        )
          await syncCatalogueMetadata(ctx, root._id, metadata)
      } else await syncCatalogueMetadata(ctx, root._id, metadata)
      if (root.subjectKind === 'CLASS' || root.subjectKind === 'RACE') {
        const current = await ctx.db.get(root._id)
        if (!current) throw new Error('Catalogue root is missing.')
        await backfillCatalogueFamily(ctx, current)
      }
    }
    return {
      processed: result.page.length,
      continueCursor: result.continueCursor,
      isDone: result.isDone
    }
  }
})
