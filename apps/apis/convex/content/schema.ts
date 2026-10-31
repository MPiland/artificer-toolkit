import { defineTable } from 'convex/server'
import { authoredStoredCompilationRowSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import { v } from 'convex/values'
import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { authoredEquipmentOptionFactsSchema } from '@artificer-toolkit/schema/api/authoredOptions'
import { authoredNodeRuntimeSourceFactsSchema } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import {
  sourceImportCatalogueDtoSchema,
  authoredContentSourceDtoSchema,
  sourceImportDefinitionDtoSchema,
  sourceImportSubjectDtoSchema,
  sourceImportSystemDtoSchema
} from '@artificer-toolkit/schema/api/sourceImport'
import {
  authoredStoredDraftPayloadChunkSchema,
  authoredStoredDraftPayloadHeadSchema,
  authoredStoredDraftSchema,
  authoredStoredVersionPayloadChunkSchema
} from '@artificer-toolkit/schema/api/authoredDrafts'
import {
  authoredCatalogueFamilySchema,
  authoredCatalogueMetadataSchema,
  authoredCatalogueOwnerCountsSchema
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { authoredImageSlotSchema } from '@artificer-toolkit/schema/api/mediaAssets'
import { authoredStoredImportReferenceSchema } from '@artificer-toolkit/schema/api/imports'
import { authoredRouteSubjectKindSchema } from '@artificer-toolkit/schema/shared/authoredRouteIdentity'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'

// Built on demand: content streams need only index metadata, and building every content table
// validator at import would cost each function that reads content (D59).
export function buildContentTables() {
  const subject = zodToConvexFields(sourceImportSubjectDtoSchema.shape)
  return {
    systemVocabularySnapshots: defineTable(zodToConvex(systemVocabularySnapshotSchema))
      .index('by_snapshotId', ['snapshotId'])
      .index('by_systemId_snapshotVersion', ['systemId', 'snapshotVersion']),
    authoredImportRefs: defineTable(zodToConvexFields(authoredStoredImportReferenceSchema.shape))
      .index('by_importJobId_subjectId', ['importJobId', 'subjectId'])
      .index('by_userId_subjectKind_subjectId_createdAt', [
        'userId',
        'subjectKind',
        'subjectId',
        'createdAt'
      ])
      .index('by_userId_source_subjectKind_externalId', [
        'userId',
        'source',
        'subjectKind',
        'externalId'
      ]),
    authoredImageSlots: defineTable(zodToConvexFields(authoredImageSlotSchema.shape))
      .index('by_subjectId_scope', ['subjectId', 'scope'])
      .index('by_importJobId_subjectId', ['importJobId', 'subjectId'])
      .index('by_assetId', ['assetId']),
    systems: defineTable(zodToConvexFields(sourceImportSystemDtoSchema.shape)).index(
      'by_publicId',
      ['id']
    ),
    contentSources: defineTable(zodToConvex(authoredContentSourceDtoSchema))
      .index('by_publicId', ['id'])
      .index('by_ownerUserId', ['ownerUserId'])
      .index('by_gameSystemId', ['gameSystemId'])
      .index('by_gameSystemId_kind_ownerUserId', ['gameSystemId', 'kind', 'ownerUserId'])
      .index('by_gameSystemId_kind_ownerUserId_code', [
        'gameSystemId',
        'kind',
        'ownerUserId',
        'code'
      ]),
    rulesCatalogues: defineTable({
      ...zodToConvexFields(sourceImportCatalogueDtoSchema.shape),
      contentSourceIds: v.array(v.string())
    })
      .index('by_publicId', ['id'])
      .index('by_gameSystemId', ['gameSystemId']),
    authoredRoots: defineTable({
      id: subject.id,
      subjectKind: subject.subjectKind,
      systemId: subject.systemId,
      label: subject.label,
      checksum: subject.checksum,
      contentSourceId: v.string(),
      importJobId: v.optional(v.string()),
      ownerUserId: v.optional(v.string()),
      // CLASS: null is a verified base; absent means canonical replay is still required.
      parentClassId: v.optional(v.union(v.string(), v.null())),
      // EQUIPMENT: null is a verified base; absent requires exact canonical replay.
      parentEquipmentId: v.optional(v.union(v.string(), v.null())),
      // RACE: null is a verified base; absent requires exact canonical replay.
      parentRaceId: v.optional(v.union(v.string(), v.null())),
      // SPELL: absent until exact replay has populated the Class dependency index.
      spellClassesIndexed: v.optional(v.literal(true)),
      catalogue: v.optional(zodToConvex(authoredCatalogueMetadataSchema)),
      catalogueFamily: v.optional(zodToConvex(authoredCatalogueFamilySchema)),
      equipmentOptions: v.optional(zodToConvex(authoredEquipmentOptionFactsSchema)),
      activeNameKey: v.optional(v.string()),
      currentVersionId: v.id('authoredVersions'),
      // The current version's public `versionId`: persisted contracts pin it, never `currentVersionId`.
      currentVersionPublicId: v.string()
    })
      .index('by_publicId', ['id'])
      .index('by_importJobId_id', ['importJobId', 'id'])
      .index('by_ownerUserId', ['ownerUserId'])
      .index('by_contentSourceId', ['contentSourceId'])
      .index('by_system_kind_parentClassId', ['systemId', 'subjectKind', 'parentClassId'])
      .index('by_system_kind_parentEquipmentId', ['systemId', 'subjectKind', 'parentEquipmentId'])
      .index('by_system_kind_parentRaceId', ['systemId', 'subjectKind', 'parentRaceId'])
      .index('by_system_kind_spellClassesIndexed', [
        'systemId',
        'subjectKind',
        'spellClassesIndexed'
      ])
      .index('by_contentSourceId_subjectKind_ownerUserId', [
        'contentSourceId',
        'subjectKind',
        'ownerUserId'
      ])
      .index('by_system_kind_owner_name_id', [
        'systemId',
        'subjectKind',
        'ownerUserId',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_kind_owner_name_id', ['subjectKind', 'ownerUserId', 'catalogue.nameKey', 'id'])
      .index('by_system_kind_owner_spellLevel_name_id', [
        'systemId',
        'subjectKind',
        'ownerUserId',
        'catalogue.spell.level',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_kind_owner_spellLevel_name_id', [
        'subjectKind',
        'ownerUserId',
        'catalogue.spell.level',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_system_kind_owner_spellSchool_name_id', [
        'systemId',
        'subjectKind',
        'ownerUserId',
        'catalogue.spell.magicSchoolNameKey',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_kind_owner_spellSchool_name_id', [
        'subjectKind',
        'ownerUserId',
        'catalogue.spell.magicSchoolNameKey',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_system_kind_owner_category_name_id', [
        'systemId',
        'subjectKind',
        'ownerUserId',
        'catalogue.category',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_kind_owner_category_name_id', [
        'subjectKind',
        'ownerUserId',
        'catalogue.category',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_system_kind_owner_family_name_id', [
        'systemId',
        'subjectKind',
        'ownerUserId',
        'catalogueFamily.nameKey',
        'catalogueFamily.id',
        'catalogue.category',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_kind_owner_family_name_id', [
        'subjectKind',
        'ownerUserId',
        'catalogueFamily.nameKey',
        'catalogueFamily.id',
        'catalogue.category',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_system_kind_owner_category_family_name_id', [
        'systemId',
        'subjectKind',
        'ownerUserId',
        'catalogue.category',
        'catalogueFamily.nameKey',
        'catalogueFamily.id',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_kind_owner_category_family_name_id', [
        'subjectKind',
        'ownerUserId',
        'catalogue.category',
        'catalogueFamily.nameKey',
        'catalogueFamily.id',
        'catalogue.nameKey',
        'id'
      ])
      .index('by_kind_owner_searchVersion_system', [
        'subjectKind',
        'ownerUserId',
        'catalogue.search.version',
        'systemId'
      ])
      .index('by_kind_owner_countsVersion', [
        'subjectKind',
        'ownerUserId',
        'catalogue.countsVersion'
      ])
      .index('by_system_kind_owner_activeName_parent_id', [
        'systemId',
        'subjectKind',
        'ownerUserId',
        'activeNameKey',
        'parentClassId',
        'id'
      ])
      .searchIndex('search_catalogue', {
        searchField: 'catalogue.search.text',
        filterFields: ['systemId', 'subjectKind', 'ownerUserId', 'catalogue.category']
      }),
    // Split from authoredRoots so Character reads of Spell/feature roots never carry the facts.
    authoredSourceFacts: defineTable({
      subjectId: subject.id,
      facts: zodToConvex(authoredNodeRuntimeSourceFactsSchema)
    }).index('by_subjectId', ['subjectId']),
    authoredSpellClasses: defineTable({
      spellId: subject.id,
      classId: subject.id,
      importJobId: v.optional(v.string())
    })
      .index('by_importJobId_spellId_classId', ['importJobId', 'spellId', 'classId'])
      .index('by_spellId', ['spellId'])
      .index('by_classId', ['classId']),
    authoredCatalogueCounts: defineTable({
      contentSourceId: v.string(),
      subjectKind: subject.subjectKind,
      count: v.number()
    }).index('by_source_kind', ['contentSourceId', 'subjectKind']),
    authoredCatalogueOwnerCounts: defineTable(
      zodToConvex(authoredCatalogueOwnerCountsSchema)
    ).index('by_subjectKind_ownerUserId', ['subjectKind', 'ownerUserId']),
    authoredDrafts: defineTable(zodToConvex(authoredStoredDraftSchema))
      .index('by_importJobId_subjectId', ['importJobId', 'subjectId'])
      .index('by_subjectId', ['subjectId'])
      .index('by_userId', ['userId'])
      .index('by_userId_subjectKind', ['userId', 'subjectKind']),
    authoredDraftPayloads: defineTable(zodToConvex(authoredStoredDraftPayloadHeadSchema))
      .index('by_publicId', ['id'])
      .index('by_importJobId_id', ['importJobId', 'id']),
    authoredDraftPayloadChunks: defineTable({
      ...zodToConvexFields(authoredStoredDraftPayloadChunkSchema.shape),
      bytes: v.bytes()
    }).index('by_subjectId_payloadId_chunkIndex', ['subjectId', 'payloadId', 'chunkIndex']),
    authoredRouteIds: defineTable({
      subjectKind: zodToConvex(authoredRouteSubjectKindSchema),
      ownerUserId: v.optional(v.string()),
      subjectId: subject.id,
      importJobId: v.optional(v.string()),
      routeNumber: v.number(),
      publicId: v.string()
    })
      .index('by_subjectId', ['subjectId'])
      .index('by_importJobId_subjectId', ['importJobId', 'subjectId'])
      .index('by_publicId', ['publicId'])
      .index('by_routeNumber', ['routeNumber']),
    authoredRouteSequence: defineTable({
      key: v.literal('authored'),
      lastNumber: v.number()
    }).index('by_key', ['key']),
    authoredVersions: defineTable({
      subjectKind: subject.subjectKind,
      id: subject.id,
      systemId: subject.systemId,
      label: subject.label,
      checksum: subject.checksum,
      documentJson: v.string(),
      documentChunkCount: v.optional(v.number()),
      documentByteLength: v.optional(v.number()),
      contentSourceId: v.string(),
      importJobId: v.optional(v.string()),
      versionId: v.string(),
      version: v.number(),
      documentSchemaVersion: v.number()
    })
      .index('by_versionId', ['versionId'])
      .index('by_importJobId_id', ['importJobId', 'id'])
      .index('by_contentSourceId', ['contentSourceId'])
      .index('by_id_version', ['id', 'version']),
    authoredVersionCompilations: defineTable({
      subjectId: v.string(),
      systemId: v.string(),
      versionId: v.string(),
      compilation: zodToConvex(authoredStoredCompilationRowSchema)
    }).index('by_versionId', ['versionId']),
    authoredVersionPayloadChunks: defineTable({
      ...zodToConvexFields(authoredStoredVersionPayloadChunkSchema.shape),
      bytes: v.bytes()
    }).index('by_versionId_chunkIndex', ['versionId', 'chunkIndex']),
    reusableDefinitions: defineTable({
      ...zodToConvexFields(zMini.omit(sourceImportDefinitionDtoSchema, { document: true }).shape),
      description: v.union(v.string(), v.null()),
      documentJson: v.optional(v.string()),
      checksum: v.optional(v.string()),
      contentSourceId: v.string(),
      gameSystemId: v.string(),
      version: v.number(),
      ownerUserId: v.optional(v.string()),
      draftVersion: v.optional(v.number()),
      contractVersion: v.optional(v.number()),
      publishedAt: v.optional(v.string()),
      publishedBy: v.optional(v.string())
    })
      .index('by_publicId', ['id'])
      .index('by_contentSourceId', ['contentSourceId'])
      .index('by_contentSourceId_version', ['contentSourceId', 'version'])
      .index('by_gameSystemId_owner_family_label_id', [
        'gameSystemId',
        'ownerUserId',
        'definitionFamilyKey',
        'label',
        'id'
      ]),
    reusableDefinitionDrafts: defineTable({
      definitionId: v.string(),
      gameSystemId: v.string(),
      authorUserId: v.string(),
      documentJson: v.string(),
      checksum: v.string(),
      baseDefinitionVersion: v.number(),
      version: v.number(),
      createdAt: v.string(),
      updatedAt: v.string()
    }).index('by_definitionId', ['definitionId'])
  }
}
