import { paginationOptsValidator, type RegisteredMutation } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v5 as uuidV5 } from 'uuid'
import {
  sourceImportBatchResultDtoSchema,
  sourceImportBootstrapInputSchema,
  sourceImportBootstrapResultDtoSchema,
  sourceImportAuditPageDtoSchema,
  sourceImportCatalogueDtoSchema,
  sourceImportContentSourceDtoSchema,
  sourceImportDefinitionDtoSchema,
  sourceImportDefinitionsInputSchema,
  sourceImportReadBootstrapInputSchema,
  sourceImportSubjectDtoSchema,
  sourceImportSubjectsInputSchema,
  sourceImportSystemDtoSchema,
  type SourceImportBootstrapResultDto,
  type SourceImportBootstrapInput,
  type SourceImportSubjectsInput,
  type SourceImportDefinitionsInput,
  type SourceImportBatchResultDto
} from '@artificer-toolkit/schema/api/sourceImport'
import { authoredDocumentVersionSchema } from '@artificer-toolkit/schema/projections/authoredContent'
import { authoredEquipmentOptionFactsSchema } from '@artificer-toolkit/schema/api/authoredOptions'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import {
  reusableDefinitionDocumentDtoSchema,
  reusableDefinitionDocumentFamilyKey
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { ensureAuthoredRouteId } from './routeIds'
import { equipmentOptionFacts } from './equipmentOptionFacts'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime/authoredSourceFacts'
import { compilePublicationDocument } from './publicationDocument'
import { requireClassParent } from './classRelationships'
import { compileCurrentRace } from './raceRelationships'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { compileCurrentEquipment } from './equipmentRelationships'
import { catalogueMetadata, syncCatalogueMetadata } from './catalogueMetadata'
import {
  authoredCatalogueMetadataSchema,
  authoredCatalogueSourceCountsSchema
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { authoredStoredCompilationSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import {
  insertAuthoredVersion,
  readAuthoredVersion,
  readPublishedDocument,
  readStoredAuthoredVersionDocument
} from './documents'
import { backfillCatalogueFamily, readCatalogueParent } from './catalogueFamilies'
import { ensureSystemVocabularySnapshot } from './systemVocabulary'

function exact(actual: unknown, expected: unknown) {
  if (
    checksumRuleDocument(jsonValueSchema.parse(actual)) !==
    checksumRuleDocument(jsonValueSchema.parse(expected))
  ) {
    throw new Error('Canonical content conflict.')
  }
}

function storedFields(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== '_id' && key !== '_creationTime')
  )
}

function validateDocument(original: unknown, parsed: unknown, checksum: string) {
  const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(parsed)))
  exact(original, document)
  if (checksumRuleDocument(document) !== checksum) throw new Error('Canonical checksum mismatch.')
}

function uniqueIds(items: readonly { id: string }[]) {
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error('Duplicate import UUID.')
}

// Hash the complete read-back record, not merely its stored checksum field. This
// proves payload and metadata parity without transporting the corpus a second time.
function auditRecord(record: { id: string; checksum: string; document: unknown }) {
  if (checksumRuleDocument(jsonValueSchema.parse(record.document)) !== record.checksum)
    throw new Error('Stored canonical checksum mismatch.')
  return {
    id: record.id,
    checksum: checksumRuleDocument(jsonValueSchema.parse(record))
  }
}

async function requireSource(ctx: QueryCtx, id: string) {
  const source = await ctx.db
    .query('contentSources')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
  if (!source || source.kind !== 'PLATFORM' || source.ownerUserId !== null)
    throw new Error('Missing platform content source.')
  return source
}

export const bootstrap: RegisteredMutation<
  'internal',
  SourceImportBootstrapInput,
  Promise<SourceImportBatchResultDto>
> = internalMutation({
  args: zodToConvexFields(sourceImportBootstrapInputSchema.shape),
  returns: zodToConvex(sourceImportBatchResultDtoSchema),
  handler: async (ctx, args) => {
    const { systems, contentSource, catalogue } = sourceImportBootstrapInputSchema.parse(args)
    uniqueIds(systems)
    if (
      catalogue.gameSystemId !== contentSource.gameSystemId ||
      !systems.some((system) => system.id === catalogue.gameSystemId)
    ) {
      throw new Error('Canonical System mismatch.')
    }
    let inserted = 0
    let reused = 0
    for (const system of systems) {
      const parsed = systemAuthoredDtoSchema.parse(system.document)
      if (parsed.id !== system.id) throw new Error('Canonical System identity mismatch.')
      validateDocument(system.document, parsed, system.checksum)
      const current = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', system.id))
        .unique()
      if (current) {
        exact(storedFields(current), system)
        reused++
      } else {
        await ctx.db.insert('systems', system)
        inserted++
      }
      await ensureSystemVocabularySnapshot(ctx, system.id)
    }
    const currentSource = await ctx.db
      .query('contentSources')
      .withIndex('by_publicId', (q) => q.eq('id', contentSource.id))
      .unique()
    if (currentSource) {
      exact(storedFields(currentSource), contentSource)
      reused++
    } else {
      await ctx.db.insert('contentSources', contentSource)
      inserted++
    }
    const record = { ...catalogue, contentSourceIds: [contentSource.id] }
    const currentCatalogue = await ctx.db
      .query('rulesCatalogues')
      .withIndex('by_publicId', (q) => q.eq('id', catalogue.id))
      .unique()
    if (currentCatalogue) {
      exact(storedFields(currentCatalogue), record)
      reused++
    } else {
      await ctx.db.insert('rulesCatalogues', record)
      inserted++
    }
    return { inserted, reused }
  }
})

export const importSubjects: RegisteredMutation<
  'internal',
  SourceImportSubjectsInput,
  Promise<SourceImportBatchResultDto>
> = internalMutation({
  args: zodToConvexFields(sourceImportSubjectsInputSchema.shape),
  returns: zodToConvex(sourceImportBatchResultDtoSchema),
  handler: async (ctx, args) => {
    const { contentSourceId, subjects } = sourceImportSubjectsInputSchema.parse(args)
    uniqueIds(subjects)
    const source = await requireSource(ctx, contentSourceId)
    let inserted = 0
    let reused = 0
    for (const subject of subjects) {
      if (subject.systemId !== source.gameSystemId) throw new Error('Canonical System mismatch.')
      const current = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', subject.id))
        .unique()
      const versionId = uuidV5(
        canonicalizeRuleDocument({
          id: subject.id,
          kind: subject.subjectKind,
          checksum: subject.checksum
        }),
        uuidV5.URL
      )
      const parsed = authoredDocumentVersionSchema.parse({
        subjectKind: subject.subjectKind,
        subjectId: subject.id,
        versionId,
        version: 1,
        documentSchemaVersion: 1,
        checksum: subject.checksum,
        document: subject.document
      })
      if (parsed.document.systemId !== subject.systemId || parsed.document.label !== subject.label)
        throw new Error('Canonical subject metadata mismatch.')
      // Exact current root/version comparison below already proves an unchanged replay payload.
      if (!current) validateDocument(subject.document, parsed.document, subject.checksum)
      if (parsed.subjectKind === 'CLASS' && parsed.document.category === 'SUBCLASS')
        await requireClassParent(ctx, parsed.document, null)
      const { document, ...metadata } = subject
      const documentJson = canonicalizeRuleDocument(document)
      const version = {
        ...metadata,
        contentSourceId,
        versionId,
        version: 1,
        documentSchemaVersion: 1
      }
      const root = {
        id: subject.id,
        subjectKind: subject.subjectKind,
        systemId: subject.systemId,
        label: subject.label,
        checksum: subject.checksum,
        contentSourceId
      }
      const equipmentOptions =
        parsed.subjectKind === 'EQUIPMENT'
          ? equipmentOptionFacts(parsed.document, parsed.checksum)
          : undefined
      const authoringSources = authoredSourceFacts(parsed)
      const compilation =
        parsed.subjectKind === 'BACKGROUND' ||
        parsed.subjectKind === 'FEAT' ||
        parsed.subjectKind === 'SPELL' ||
        parsed.subjectKind === 'CREATURE' ||
        parsed.subjectKind === 'VEHICLE'
          ? compilePublicationDocument(parsed)
          : undefined
      const parentClassId =
        parsed.subjectKind === 'CLASS'
          ? parsed.document.category === 'SUBCLASS'
            ? parsed.document.parentClassId
            : null
          : undefined
      const parentEquipmentId =
        parsed.subjectKind === 'EQUIPMENT'
          ? parsed.document.category === 'VARIANT'
            ? parsed.document.parentEquipmentId
            : null
          : undefined
      const parentRaceId =
        parsed.subjectKind === 'RACE'
          ? parsed.document.category === 'SUBRACE'
            ? parsed.document.parentRaceId
            : null
          : undefined
      const publicId = await ensureAuthoredRouteId(ctx, subject.subjectKind, subject.id, true)
      if (current) {
        const {
          equipmentOptions: storedOptions,
          authoringSources: storedAuthoringSources,
          catalogue: storedCatalogue,
          catalogueFamily: storedCatalogueFamily,
          parentClassId: storedParentClassId,
          parentEquipmentId: storedParentEquipmentId,
          parentRaceId: storedParentRaceId,
          spellClassesIndexed: storedSpellClassesIndexed,
          ...currentFields
        } = storedFields(current)
        exact(currentFields, {
          ...root,
          currentVersionId: current.currentVersionId
        })
        if (storedCatalogueFamily) {
          const parent = await readCatalogueParent(ctx, current, null)
          exact(storedCatalogueFamily, {
            id: parent?.id ?? current.id,
            nameKey: (parent?.label ?? current.label).toLowerCase()
          })
        }
        if (storedParentClassId !== undefined) exact(storedParentClassId, parentClassId)
        else if (parentClassId !== undefined) await ctx.db.patch(current._id, { parentClassId })
        if (storedParentEquipmentId !== undefined) exact(storedParentEquipmentId, parentEquipmentId)
        else if (parentEquipmentId !== undefined)
          await ctx.db.patch(current._id, { parentEquipmentId })
        if (storedParentRaceId !== undefined) exact(storedParentRaceId, parentRaceId)
        else if (parentRaceId !== undefined) await ctx.db.patch(current._id, { parentRaceId })
        const storedVersion = await ctx.db.get(current.currentVersionId)
        if (!storedVersion) throw new Error('Missing canonical version.')
        const storedVersionFields = storedFields(storedVersion)
        const storedCompilation = storedVersion.compilation
        delete storedVersionFields.compilation
        delete storedVersionFields.documentJson
        delete storedVersionFields.documentChunkCount
        delete storedVersionFields.documentByteLength
        exact(storedVersionFields, version)
        exact(await readStoredAuthoredVersionDocument(ctx, storedVersion), parsed.document)
        const existingEquipmentOptions =
          parsed.subjectKind === 'EQUIPMENT' && storedOptions !== undefined
            ? authoredEquipmentOptionFactsSchema.parse(storedOptions)
            : undefined
        const equipment =
          parsed.subjectKind === 'EQUIPMENT' &&
          (storedCompilation !== undefined || existingEquipmentOptions?.builder !== undefined)
            ? await compileCurrentEquipment(ctx, parsed.document, null)
            : undefined
        if (storedCompilation !== undefined) {
          if (compilation) exact(storedCompilation, compilation)
          else if (equipment) exact(storedCompilation, equipment.compilation)
          else if (parsed.subjectKind === 'RACE')
            exact(
              storedCompilation,
              (await compileCurrentRace(ctx, parsed.document, null)).compilation
            )
          else if (parsed.subjectKind !== 'CLASS')
            throw new Error('Unexpected canonical compilation.')
        } else if (compilation) {
          await ctx.db.patch(storedVersion._id, { compilation })
        }
        if (storedOptions !== undefined) {
          if (!equipmentOptions) throw new Error('Unexpected equipment option facts.')
          if (equipment && parsed.subjectKind === 'EQUIPMENT') {
            if (!existingEquipmentOptions) throw new Error('Unexpected equipment option facts.')
            const expected = equipmentOptionFacts(
              parsed.document,
              parsed.checksum,
              equipment.effective
            )
            if (existingEquipmentOptions.builder === undefined) {
              exact(existingEquipmentOptions, equipmentOptions)
              await ctx.db.patch(current._id, { equipmentOptions: expected })
            } else exact(existingEquipmentOptions, expected)
          } else exact(storedOptions, equipmentOptions)
        } else if (equipmentOptions) {
          // Backfill only an exact, already-verified immutable canonical record.
          await ctx.db.patch(current._id, {
            equipmentOptions:
              equipment && parsed.subjectKind === 'EQUIPMENT'
                ? equipmentOptionFacts(parsed.document, parsed.checksum, equipment.effective)
                : equipmentOptions
          })
        }
        if (storedAuthoringSources !== undefined) exact(storedAuthoringSources, authoringSources)
        else await ctx.db.patch(current._id, { authoringSources })
        const catalogue = await catalogueMetadata(ctx, parsed.document, {
          checksum: subject.checksum,
          publicId,
          createdAt: storedVersion._creationTime
        })
        if (storedCatalogue !== undefined) {
          const existing = authoredCatalogueMetadataSchema.parse(storedCatalogue)
          exact(
            {
              ...existing,
              search: existing.search ?? catalogue.search,
              countsVersion: existing.countsVersion ?? catalogue.countsVersion,
              ...(catalogue.selectionMode !== undefined
                ? {
                    selectionMode: existing.selectionMode ?? catalogue.selectionMode
                  }
                : {}),
              ...(catalogue.spell !== undefined ? { spell: existing.spell ?? catalogue.spell } : {})
            },
            catalogue
          )
          if (
            existing.search === undefined ||
            existing.countsVersion === undefined ||
            (catalogue.selectionMode !== undefined && existing.selectionMode === undefined) ||
            (catalogue.spell !== undefined && existing.spell === undefined) ||
            (current.subjectKind === 'SPELL' && storedSpellClassesIndexed !== true)
          ) {
            await syncCatalogueMetadata(ctx, current._id, catalogue)
          }
        } else await syncCatalogueMetadata(ctx, current._id, catalogue)
        reused++
      } else {
        const orphan = await ctx.db
          .query('authoredVersions')
          .withIndex('by_id_version', (q) => q.eq('id', subject.id).eq('version', 1))
          .unique()
        if (orphan) throw new Error('Orphan canonical version.')
        const currentVersionId = await insertAuthoredVersion(
          ctx,
          {
            ...version,
            ...(compilation ? { compilation } : {})
          },
          documentJson
        )
        const rootId = await ctx.db.insert('authoredRoots', {
          ...root,
          currentVersionId,
          authoringSources,
          equipmentOptions,
          parentClassId,
          parentEquipmentId,
          parentRaceId
        })
        const published = await ctx.db.get(currentVersionId)
        if (!published) throw new Error('Missing canonical version.')
        await syncCatalogueMetadata(
          ctx,
          rootId,
          await catalogueMetadata(ctx, parsed.document, {
            checksum: subject.checksum,
            publicId,
            createdAt: published._creationTime
          })
        )
        inserted++
      }
    }
    return { inserted, reused }
  }
})

export const importDefinitions: RegisteredMutation<
  'internal',
  SourceImportDefinitionsInput,
  Promise<SourceImportBatchResultDto>
> = internalMutation({
  args: zodToConvexFields(sourceImportDefinitionsInputSchema.shape),
  returns: zodToConvex(sourceImportBatchResultDtoSchema),
  handler: async (ctx, args) => {
    const { contentSourceId, definitions } = sourceImportDefinitionsInputSchema.parse(args)
    uniqueIds(definitions)
    const source = await requireSource(ctx, contentSourceId)
    let inserted = 0
    let reused = 0
    for (const definition of definitions) {
      const parsed = reusableDefinitionDocumentDtoSchema.parse(definition.document)
      if (
        parsed.id !== definition.id ||
        parsed.gameSystemId !== source.gameSystemId ||
        reusableDefinitionDocumentFamilyKey(parsed) !== definition.definitionFamilyKey
      )
        throw new Error('Canonical definition identity mismatch.')
      validateDocument(definition.document, parsed, definition.checksum)
      const record = {
        ...definition,
        contentSourceId,
        gameSystemId: source.gameSystemId,
        version: 1
      }
      const current = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', definition.id))
        .unique()
      if (current) {
        exact(storedFields(current), record)
        reused++
      } else {
        await ctx.db.insert('reusableDefinitions', record)
        inserted++
      }
    }
    return { inserted, reused }
  }
})

export const readBootstrap = internalQuery({
  args: zodToConvexFields(sourceImportReadBootstrapInputSchema.shape),
  returns: zodToConvex(sourceImportBootstrapResultDtoSchema),
  handler: async (ctx, args): Promise<SourceImportBootstrapResultDto> => {
    const input = sourceImportReadBootstrapInputSchema.parse(args)
    const source = await requireSource(ctx, input.contentSourceId)
    const catalogue = await ctx.db
      .query('rulesCatalogues')
      .withIndex('by_publicId', (q) => q.eq('id', input.catalogueId))
      .unique()
    if (!catalogue || catalogue.gameSystemId !== source.gameSystemId)
      throw new Error('Missing canonical catalogue.')
    exact(catalogue.contentSourceIds, [source.id])
    const { contentSourceIds: _sources, ...catalogueFields } = storedFields(catalogue)
    const systems = await Promise.all(
      input.systemIds.map(async (id) => {
        const system = await ctx.db
          .query('systems')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
        if (!system) throw new Error('Missing canonical System.')
        return auditRecord(sourceImportSystemDtoSchema.parse(storedFields(system)))
      })
    )
    return {
      systems,
      contentSource: sourceImportContentSourceDtoSchema.parse(storedFields(source)),
      catalogue: sourceImportCatalogueDtoSchema.parse(catalogueFields)
    }
  }
})

const pageArgs = {
  contentSourceId: v.string(),
  paginationOpts: paginationOptsValidator
}
function checkPageSize(size: number) {
  if (!Number.isInteger(size) || size < 1 || size > 10)
    throw new Error('Import page size must be 1..10.')
}

export const readSubjects = internalQuery({
  args: pageArgs,
  returns: zodToConvex(sourceImportAuditPageDtoSchema),
  handler: async (ctx, args) => {
    checkPageSize(args.paginationOpts.numItems)
    const source = await requireSource(ctx, args.contentSourceId)
    const result = await ctx.db
      .query('authoredRoots')
      .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', source.id))
      .paginate(args.paginationOpts)
    const page = await Promise.all(
      result.page.map(async (root) => {
        const version = await ctx.db.get(root.currentVersionId)
        if (
          !version ||
          version.id !== root.id ||
          version.contentSourceId !== source.id ||
          version.systemId !== source.gameSystemId ||
          version.version !== 1 ||
          version.documentSchemaVersion !== 1
        )
          throw new Error('Invalid canonical version pointer.')
        exact(
          {
            id: root.id,
            subjectKind: root.subjectKind,
            systemId: root.systemId,
            label: root.label,
            checksum: root.checksum
          },
          {
            id: version.id,
            subjectKind: version.subjectKind,
            systemId: version.systemId,
            label: version.label,
            checksum: version.checksum
          }
        )
        const document = await readStoredAuthoredVersionDocument(ctx, version)
        const audit = auditRecord(
          sourceImportSubjectDtoSchema.parse({
            id: root.id,
            subjectKind: root.subjectKind,
            systemId: root.systemId,
            label: root.label,
            checksum: root.checksum,
            document
          })
        )
        const route = await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', root.id))
          .unique()
        if (!route || route.subjectKind !== root.subjectKind)
          throw new Error('Canonical route mismatch.')
        const parsed = authoredDocumentVersionSchema.parse({
          subjectKind: version.subjectKind,
          subjectId: version.id,
          versionId: version.versionId,
          version: version.version,
          documentSchemaVersion: version.documentSchemaVersion,
          checksum: version.checksum,
          document
        })
        const parsedDocument = parsed.document
        exact(root.authoringSources, authoredSourceFacts(parsed))
        exact(
          root.catalogue,
          await catalogueMetadata(ctx, parsedDocument, {
            checksum: root.checksum,
            publicId: route.publicId,
            createdAt: version._creationTime
          })
        )
        if (
          parsed.subjectKind === 'BACKGROUND' ||
          parsed.subjectKind === 'FEAT' ||
          parsed.subjectKind === 'SPELL' ||
          parsed.subjectKind === 'CREATURE' ||
          parsed.subjectKind === 'VEHICLE'
        )
          exact(version.compilation, compilePublicationDocument(parsed))
        if (parsed.subjectKind === 'CLASS') {
          exact(
            root.parentClassId,
            parsed.document.category === 'SUBCLASS' ? parsed.document.parentClassId : null
          )
          if (parsed.document.category === 'SUBCLASS')
            await requireClassParent(ctx, parsed.document, null)
          const parent = await readCatalogueParent(ctx, root, null)
          exact(root.catalogueFamily, {
            id: parent?.id ?? root.id,
            nameKey: (parent?.label ?? root.label).toLowerCase()
          })
        }
        if (parsed.subjectKind === 'RACE') {
          const document = raceAuthoredDtoSchema.parse(parsed.document)
          exact(root.parentRaceId, document.category === 'SUBRACE' ? document.parentRaceId : null)
          exact(version.compilation, (await compileCurrentRace(ctx, document, null)).compilation)
          const parent = await readCatalogueParent(ctx, root, null)
          exact(root.catalogueFamily, {
            id: parent?.id ?? root.id,
            nameKey: (parent?.label ?? root.label).toLowerCase()
          })
        }
        if (parsed.subjectKind === 'EQUIPMENT') {
          exact(
            root.parentEquipmentId,
            parsed.document.category === 'VARIANT' ? parsed.document.parentEquipmentId : null
          )
          const equipment = await compileCurrentEquipment(ctx, parsed.document, null)
          exact(
            root.equipmentOptions,
            equipmentOptionFacts(parsed.document, root.checksum, equipment.effective)
          )
          exact(version.compilation, equipment.compilation)
        }
        return audit
      })
    )
    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor
    }
  }
})

// Equipment parents may arrive in a later import batch. Compile only after all roots exist.
export const syncEquipmentDerived = internalMutation({
  args: {
    id: zodToConvex(sourceImportSubjectDtoSchema.shape.id),
    checksum: zodToConvex(authoredStoredCompilationSchema.shape.authoredChecksum)
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', args.id))
      .unique()
    if (
      !root ||
      root.subjectKind !== 'EQUIPMENT' ||
      root.ownerUserId !== undefined ||
      root.checksum !== args.checksum
    )
      throw new Error('Canonical Equipment identity mismatch.')
    await requireSource(ctx, root.contentSourceId)
    const version = await readAuthoredVersion(ctx, root)
    const document = equipmentAuthoredDtoSchema.parse(
      await readPublishedDocument(ctx, root, version)
    )
    exact(
      root.parentEquipmentId,
      document.category === 'VARIANT' ? document.parentEquipmentId : null
    )
    const { compilation, effective } = await compileCurrentEquipment(ctx, document, null)
    if (version.compilation === undefined) await ctx.db.patch(version._id, { compilation })
    else exact(version.compilation, compilation)
    const rawFacts = equipmentOptionFacts(document, root.checksum)
    const expectedFacts = equipmentOptionFacts(document, root.checksum, effective)
    if (root.equipmentOptions === undefined) {
      await ctx.db.patch(root._id, { equipmentOptions: expectedFacts })
    } else if (root.equipmentOptions.builder === undefined) {
      exact(root.equipmentOptions, rawFacts)
      await ctx.db.patch(root._id, { equipmentOptions: expectedFacts })
    } else exact(root.equipmentOptions, expectedFacts)
    return null
  }
})

const classDerivedArgs = {
  id: v.string(),
  checksum: v.string(),
  parentClassId: v.union(v.string(), v.null()),
  compilation: zodToConvex(authoredStoredCompilationSchema)
}

async function readCanonicalClass(ctx: QueryCtx, id: string, checksum: string) {
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
  if (
    !root ||
    root.subjectKind !== 'CLASS' ||
    root.ownerUserId !== undefined ||
    root.checksum !== checksum
  )
    throw new Error('Canonical Class identity mismatch.')
  await requireSource(ctx, root.contentSourceId)
  const version = await readAuthoredVersion(ctx, root)
  const document = await readPublishedDocument(ctx, root, version)
  const parentClassId = document.category === 'SUBCLASS' ? document.parentClassId : null
  if (parentClassId !== null && typeof parentClassId !== 'string')
    throw new Error('Canonical Class parent mismatch.')
  return { root, version, parentClassId }
}

export const syncClassDerived = internalMutation({
  args: classDerivedArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const compilation = authoredStoredCompilationSchema.parse(args.compilation)
    if (compilation.authoredChecksum !== args.checksum)
      throw new Error('Canonical Class compilation mismatch.')
    const current = await readCanonicalClass(ctx, args.id, args.checksum)
    if (current.root.parentClassId === undefined)
      await ctx.db.patch(current.root._id, {
        parentClassId: args.parentClassId
      })
    else exact(current.root.parentClassId, args.parentClassId)
    if (current.parentClassId !== args.parentClassId)
      throw new Error('Canonical Class parent mismatch.')
    if (current.version.compilation === undefined)
      await ctx.db.patch(current.version._id, { compilation })
    else exact(current.version.compilation, compilation)
    const root = await ctx.db.get(current.root._id)
    if (!root) throw new Error('Canonical Class root is missing.')
    await backfillCatalogueFamily(ctx, root)
    return null
  }
})

export const readClassDerived = internalQuery({
  args: { id: v.string(), checksum: v.string() },
  returns: v.object({
    parentClassId: v.union(v.string(), v.null()),
    compilation: zodToConvex(authoredStoredCompilationSchema)
  }),
  handler: async (ctx, args) => {
    const current = await readCanonicalClass(ctx, args.id, args.checksum)
    if (current.root.parentClassId === undefined || current.version.compilation === undefined)
      throw new Error('Canonical Class derived metadata is missing.')
    exact(current.root.parentClassId, current.parentClassId)
    return {
      parentClassId: current.root.parentClassId,
      compilation: current.version.compilation
    }
  }
})

export const readDefinitions = internalQuery({
  args: pageArgs,
  returns: zodToConvex(sourceImportAuditPageDtoSchema),
  handler: async (ctx, args) => {
    checkPageSize(args.paginationOpts.numItems)
    const source = await requireSource(ctx, args.contentSourceId)
    const result = await ctx.db
      .query('reusableDefinitions')
      .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', source.id))
      .paginate(args.paginationOpts)
    const page = result.page.map((row) => {
      if (row.gameSystemId !== source.gameSystemId || row.version !== 1)
        throw new Error('Invalid canonical definition metadata.')
      return auditRecord(
        sourceImportDefinitionDtoSchema.parse({
          id: row.id,
          definitionFamilyKey: row.definitionFamilyKey,
          label: row.label,
          description: row.description,
          checksum: row.checksum,
          document: row.document
        })
      )
    })
    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor
    }
  }
})

export const readCatalogueCounts = internalQuery({
  args: { contentSourceId: v.string() },
  returns: zodToConvex(authoredCatalogueSourceCountsSchema),
  handler: async (ctx, args) => {
    const source = await requireSource(ctx, args.contentSourceId)
    const rows = await ctx.db
      .query('authoredCatalogueCounts')
      .withIndex('by_source_kind', (q) => q.eq('contentSourceId', source.id))
      .take(9)
    if (new Set(rows.map((row) => row.subjectKind)).size !== rows.length)
      throw new Error('Duplicate catalogue count.')
    return authoredCatalogueSourceCountsSchema.parse(
      rows.map(({ subjectKind, count }) => ({ subjectKind, count }))
    )
  }
})
