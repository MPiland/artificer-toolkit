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
import { AUTHORED_SOURCE_FACTS_VERSION } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import {
  reusableDefinitionDocumentDtoSchema,
  reusableDefinitionDocumentFamilyKey
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import {
  canonicalizeRuleDocument,
  checksumCanonicalRuleDocument,
  checksumRuleDocument
} from '@artificer-toolkit/shared/rules'
import type { QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { internalMutation } from '../lib/mutations'
import { ensureAuthoredRouteId } from './routeIds'
import { readSystem } from './systemDocuments'
import { readSystemOwner } from './definitionStore'
import { decodeDefinitionDocument, encodeDefinitionDocument } from './definitionDocumentJson'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime/authoredSourceFacts'
import { compilePublicationDocument } from './publicationDocument'
import { assertNoClassChildren, requireClassParent } from './classRelationships'
import {
  assertNoRaceChildren,
  compileCurrentRace,
  recompileRaceChildren
} from './raceRelationships'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { compileCurrentEquipment, recompileEquipmentChildren } from './equipmentRelationships'
import { replaceCurrentAuthoredVersion } from './authoredReplacement'
import { readStoredSourceFacts, writeSourceFacts } from './sourceFacts'
import { catalogueMetadata, syncCatalogueMetadata } from './catalogueMetadata'
import {
  authoredCatalogueMetadataSchema,
  authoredCatalogueSourceCountsSchema
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { authoredStoredCompilationSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import {
  insertAuthoredVersion,
  readAuthoredVersionCompilation,
  readAuthoredVersionCompilationRow,
  readAuthoredVersion,
  readPublishedDocument,
  readStoredAuthoredVersionDocument,
  syncCanonicalCompilation
} from './documents'
import { backfillCatalogueFamily, readCatalogueParent } from './catalogueFamilies'
import {
  advanceSystemVocabularySnapshot,
  ensureSystemVocabularySnapshot,
  removedVocabularyIds
} from './systemVocabulary'

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

// A stored canonical row whose identity fields are unchanged is replaced in place: returns the new
// values of the `mutable` fields, or null when they already match. A changed identity field is a conflict.
function mutableChanges(
  stored: Record<string, unknown>,
  record: Record<string, unknown>,
  mutable: readonly string[]
) {
  const split = (row: Record<string, unknown>) => ({
    identity: Object.fromEntries(Object.entries(row).filter(([key]) => !mutable.includes(key))),
    values: Object.fromEntries(mutable.map((key) => [key, row[key]]))
  })
  const current = split(storedFields(stored))
  const next = split(record)
  exact(current.identity, next.identity)
  return checksumRuleDocument(jsonValueSchema.parse(current.values)) ===
    checksumRuleDocument(jsonValueSchema.parse(next.values))
    ? null
    : next.values
}

// Canonicalizes the original once; that string proves schema-parse parity and the checksum.
// Returns it so a caller that inserts the document can store it.
function validateDocument(original: unknown, parsed: unknown, checksum: string) {
  const canonical = canonicalizeRuleDocument(original)
  if (canonicalizeRuleDocument(parsed) !== canonical) throw new Error('Canonical content conflict.')
  if (checksumCanonicalRuleDocument(canonical) !== checksum)
    throw new Error('Canonical checksum mismatch.')
  return canonical
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
    let replaced = 0
    for (const system of systems) {
      const parsed = systemAuthoredDtoSchema.parse(system.document)
      if (parsed.id !== system.id) throw new Error('Canonical System identity mismatch.')
      validateDocument(system.document, parsed, system.checksum)
      const current = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', system.id))
        .unique()
      if (current) {
        const changes = mutableChanges(current, system, ['document', 'checksum'])
        if (changes) {
          const removed = removedVocabularyIds(readSystem(current), parsed)
          if (removed.length)
            throw new Error(
              `Canonical System replacement removes vocabulary entries stored data may name: ${removed.join(', ')}.`
            )
          await ctx.db.patch(current._id, changes)
          await advanceSystemVocabularySnapshot(ctx, parsed)
          replaced++
        } else reused++
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
      const changes = mutableChanges(currentSource, contentSource, ['label', 'description'])
      if (changes) {
        await ctx.db.patch(currentSource._id, changes)
        replaced++
      } else reused++
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
      const changes = mutableChanges(currentCatalogue, record, ['label', 'description'])
      if (changes) {
        await ctx.db.patch(currentCatalogue._id, changes)
        replaced++
      } else reused++
    } else {
      await ctx.db.insert('rulesCatalogues', record)
      inserted++
    }
    return { inserted, reused, replaced }
  }
})

/** Catalogue facts introduced after rows were stored; a reimport adds them to an exact match. */
const BACKFILLED_CATALOGUE_FACTS = [
  'search',
  'countsVersion',
  'publishedActive',
  'race',
  'class',
  'background',
  'equipment',
  'selectionMode',
  'spell'
] as const

export const importSubjects: RegisteredMutation<
  'internal',
  SourceImportSubjectsInput,
  Promise<SourceImportBatchResultDto>
> = internalMutation({
  args: zodToConvexFields(sourceImportSubjectsInputSchema.shape),
  returns: zodToConvex(sourceImportBatchResultDtoSchema),
  handler: async (ctx, args) => {
    const { contentSourceId, subjects, reimportedSubjectIds } =
      sourceImportSubjectsInputSchema.parse(args)
    uniqueIds(subjects)
    const reimportedIds = new Set(reimportedSubjectIds)
    const source = await requireSource(ctx, contentSourceId)
    let inserted = 0
    let reused = 0
    let replaced = 0
    for (const subject of subjects) {
      if (subject.systemId !== source.gameSystemId) throw new Error('Canonical System mismatch.')
      const current = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', subject.id))
        .unique()
      // A different checksum is a corpus change: the stored subject is replaced in place.
      const changed = current !== null && current.checksum !== subject.checksum
      if (
        current &&
        changed &&
        (current.subjectKind !== subject.subjectKind ||
          current.systemId !== subject.systemId ||
          current.contentSourceId !== contentSourceId)
      )
        throw new Error('Canonical content conflict.')
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
      const { document, ...metadata } = subject
      if (parsed.subjectKind === 'CLASS' && parsed.document.category === 'SUBCLASS')
        await requireClassParent(ctx, parsed.document, null)
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
        contentSourceId,
        currentVersionPublicId: versionId
      }
      // A base Equipment or Race has no parent to wait for; a variant or subrace compiles in its
      // derived sync once every root exists.
      const baseEquipment =
        parsed.subjectKind === 'EQUIPMENT' && parsed.document.category !== 'VARIANT'
          ? await compileCurrentEquipment(ctx, parsed.document, null)
          : undefined
      const baseRace =
        parsed.subjectKind === 'RACE' && parsed.document.category !== 'SUBRACE'
          ? await compileCurrentRace(ctx, parsed.document, null)
          : undefined
      const equipmentOptions =
        parsed.subjectKind === 'EQUIPMENT'
          ? equipmentOptionFacts(parsed.document, parsed.checksum, baseEquipment?.effective)
          : undefined
      const authoringSources = authoredSourceFacts(parsed)
      const compilation =
        parsed.subjectKind === 'BACKGROUND' ||
        parsed.subjectKind === 'FEAT' ||
        parsed.subjectKind === 'SPELL' ||
        parsed.subjectKind === 'CREATURE' ||
        parsed.subjectKind === 'VEHICLE'
          ? compilePublicationDocument(parsed)
          : (baseEquipment ?? baseRace)?.compilation
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
      if (current && changed) {
        const previous = await ctx.db.get(current.currentVersionId)
        if (!previous) throw new Error('Missing canonical version.')
        // The same dependent checks and child recompilation as publishing a changed document.
        if (parsed.subjectKind === 'CLASS' && parsed.document.category === 'SUBCLASS')
          await assertNoClassChildren(ctx, current.systemId, current.id)
        if (parsed.subjectKind === 'RACE' && parsed.document.category === 'SUBRACE')
          await assertNoRaceChildren(ctx, current.systemId, current.id)
        const equipment =
          parsed.subjectKind === 'EQUIPMENT'
            ? await compileCurrentEquipment(ctx, parsed.document, null)
            : undefined
        const race =
          parsed.subjectKind === 'RACE'
            ? await compileCurrentRace(ctx, parsed.document, null)
            : undefined
        await replaceCurrentAuthoredVersion(ctx, {
          root: current,
          previous,
          version: { ...version, version: previous.version + 1 },
          documentJson: validateDocument(document, parsed.document, subject.checksum),
          compilation: compilation ?? equipment?.compilation ?? race?.compilation,
          current: {
            ...root,
            equipmentOptions:
              parsed.subjectKind === 'EQUIPMENT' && equipment
                ? equipmentOptionFacts(parsed.document, parsed.checksum, equipment.effective)
                : equipmentOptions,
            parentClassId,
            parentEquipmentId,
            parentRaceId
          },
          authoringSources,
          document: parsed.document,
          publicId
        })
        if (equipment)
          await recompileEquipmentChildren(ctx, equipment.effective, null, reimportedIds)
        if (race?.effective.category === 'BASE')
          await recompileRaceChildren(ctx, race.effective, null, reimportedIds)
        replaced++
      } else if (current) {
        const {
          equipmentOptions: storedOptions,
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
        const storedCompilationRow = await readAuthoredVersionCompilationRow(ctx, storedVersion)
        delete storedVersionFields.documentJson
        delete storedVersionFields.documentChunkCount
        delete storedVersionFields.documentByteLength
        exact(storedVersionFields, { ...version, version: storedVersion.version })
        exact(await readStoredAuthoredVersionDocument(ctx, storedVersion), parsed.document)
        const existingEquipmentOptions =
          parsed.subjectKind === 'EQUIPMENT' && storedOptions !== undefined
            ? authoredEquipmentOptionFactsSchema.parse(storedOptions)
            : undefined
        const equipment =
          parsed.subjectKind === 'EQUIPMENT' &&
          (storedCompilationRow !== null || existingEquipmentOptions?.builder !== undefined)
            ? await compileCurrentEquipment(ctx, parsed.document, null)
            : undefined
        // A Class, and a subrace not compiled yet, are synced after every root exists.
        const expectedCompilation =
          compilation ??
          equipment?.compilation ??
          (parsed.subjectKind === 'RACE' && storedCompilationRow !== null
            ? (await compileCurrentRace(ctx, parsed.document, null)).compilation
            : undefined)
        if (expectedCompilation) {
          const storedCompilation = await syncCanonicalCompilation(
            ctx,
            current,
            storedVersion,
            expectedCompilation
          )
          if (storedCompilation) exact(storedCompilation, expectedCompilation)
        } else if (storedCompilationRow !== null && parsed.subjectKind !== 'CLASS')
          throw new Error('Unexpected canonical compilation.')
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
              exact(
                existingEquipmentOptions,
                equipmentOptionFacts(parsed.document, parsed.checksum)
              )
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
        // Facts from an older derivation are re-derived; same-version facts that differ conflict.
        const storedAuthoringSources = await readStoredSourceFacts(ctx, current)
        if (storedAuthoringSources?.factsVersion === AUTHORED_SOURCE_FACTS_VERSION)
          exact(storedAuthoringSources, authoringSources)
        else await writeSourceFacts(ctx, current.id, authoringSources)
        const catalogue = await catalogueMetadata(ctx, parsed, {
          checksum: subject.checksum,
          publicId,
          createdAt: storedVersion._creationTime
        })
        if (storedCatalogue !== undefined) {
          const existing = authoredCatalogueMetadataSchema.parse(storedCatalogue)
          // Facts added after a row was stored backfill; every other stored fact must match exactly.
          const missing = BACKFILLED_CATALOGUE_FACTS.filter(
            (key) => catalogue[key] !== undefined && existing[key] === undefined
          )
          exact(
            {
              ...existing,
              ...Object.fromEntries(missing.map((key) => [key, catalogue[key]]))
            },
            catalogue
          )
          if (
            missing.length > 0 ||
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
          version,
          validateDocument(document, parsed.document, subject.checksum),
          compilation
        )
        const rootId = await ctx.db.insert('authoredRoots', {
          ...root,
          currentVersionId,
          equipmentOptions,
          parentClassId,
          parentEquipmentId,
          parentRaceId
        })
        await writeSourceFacts(ctx, root.id, authoringSources)
        const published = await ctx.db.get(currentVersionId)
        if (!published) throw new Error('Missing canonical version.')
        await syncCatalogueMetadata(
          ctx,
          rootId,
          await catalogueMetadata(ctx, parsed, {
            checksum: subject.checksum,
            publicId,
            createdAt: published._creationTime
          })
        )
        inserted++
      }
    }
    return { inserted, reused, replaced }
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
    const publishedBy = await readSystemOwner(ctx, source.gameSystemId)
    let inserted = 0
    let reused = 0
    let replaced = 0
    for (const definition of definitions) {
      const parsed = reusableDefinitionDocumentDtoSchema.parse(definition.document)
      if (
        parsed.id !== definition.id ||
        parsed.gameSystemId !== source.gameSystemId ||
        reusableDefinitionDocumentFamilyKey(parsed) !== definition.definitionFamilyKey
      )
        throw new Error('Canonical definition identity mismatch.')
      validateDocument(definition.document, parsed, definition.checksum)
      const { document, ...fields } = definition
      const record = {
        ...fields,
        documentJson: encodeDefinitionDocument(document),
        contentSourceId,
        gameSystemId: source.gameSystemId,
        version: 1,
        contractVersion: 1,
        publishedBy
      }
      const current = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', definition.id))
        .unique()
      if (current) {
        // A row seeded before the publication metadata existed is backfilled; a different value conflicts.
        const publication = {
          contractVersion: current.contractVersion ?? record.contractVersion,
          publishedBy: current.publishedBy ?? record.publishedBy,
          publishedAt: current.publishedAt ?? new Date().toISOString()
        }
        const changes = mutableChanges(
          { ...current, ...publication },
          { ...record, publishedAt: publication.publishedAt },
          ['label', 'description', 'checksum', 'documentJson']
        )
        if (changes) {
          await ctx.db.patch(current._id, {
            ...changes,
            ...publication,
            publishedAt: new Date().toISOString()
          })
          replaced++
        } else {
          if (
            current.contractVersion === undefined ||
            current.publishedBy === undefined ||
            current.publishedAt === undefined
          )
            await ctx.db.patch(current._id, publication)
          reused++
        }
      } else {
        await ctx.db.insert('reusableDefinitions', {
          ...record,
          publishedAt: new Date().toISOString()
        })
        inserted++
      }
    }
    return { inserted, reused, replaced }
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

// Stored id and subject checksum only (readSubjects is the full read-back audit). The seed compares
// them with the corpus to refuse a removal and to batch each replaced subject alone.
export const readSubjectChecksums = internalQuery({
  args: pageArgs,
  returns: zodToConvex(sourceImportAuditPageDtoSchema),
  handler: async (ctx, args) => {
    checkPageSize(args.paginationOpts.numItems)
    const source = await requireSource(ctx, args.contentSourceId)
    const result = await ctx.db
      .query('authoredRoots')
      .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', source.id))
      .paginate(args.paginationOpts)
    return {
      page: result.page.map(({ id, checksum }) => ({ id, checksum })),
      isDone: result.isDone,
      continueCursor: result.continueCursor
    }
  }
})

// Stored id and checksum only, so the seed can refuse a removed definition before it writes.
export const readDefinitionChecksums = internalQuery({
  args: pageArgs,
  returns: zodToConvex(sourceImportAuditPageDtoSchema),
  handler: async (ctx, args) => {
    checkPageSize(args.paginationOpts.numItems)
    const source = await requireSource(ctx, args.contentSourceId)
    const result = await ctx.db
      .query('reusableDefinitions')
      .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', source.id))
      .paginate(args.paginationOpts)
    return {
      page: result.page.map(({ id, checksum }) => {
        if (checksum === undefined) throw new Error('Invalid canonical definition metadata.')
        return { id, checksum }
      }),
      isDone: result.isDone,
      continueCursor: result.continueCursor
    }
  }
})

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
          version.version < 1 ||
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
        exact(await readStoredSourceFacts(ctx, root), authoredSourceFacts(parsed))
        exact(
          root.catalogue,
          await catalogueMetadata(ctx, parsed, {
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
          exact(
            await readAuthoredVersionCompilation(ctx, version),
            compilePublicationDocument(parsed)
          )
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
          exact(
            await readAuthoredVersionCompilation(ctx, version),
            (await compileCurrentRace(ctx, document, null)).compilation
          )
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
          exact(await readAuthoredVersionCompilation(ctx, version), equipment.compilation)
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

// Variant parents may arrive in a later import batch. Compile only after all roots exist.
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
    const storedCompilation = await syncCanonicalCompilation(ctx, root, version, compilation)
    if (storedCompilation) exact(storedCompilation, compilation)
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
    const storedCompilation = await syncCanonicalCompilation(
      ctx,
      current.root,
      current.version,
      compilation
    )
    if (storedCompilation) exact(storedCompilation, compilation)
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
    const compilation = await readAuthoredVersionCompilation(ctx, current.version)
    if (current.root.parentClassId === undefined || compilation === undefined)
      throw new Error('Canonical Class derived metadata is missing.')
    exact(current.root.parentClassId, current.parentClassId)
    return {
      parentClassId: current.root.parentClassId,
      compilation
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
          document: decodeDefinitionDocument(row.documentJson)
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
