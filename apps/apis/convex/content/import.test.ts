import { convexTest } from '../../tests/convexTest'
import type { TestConvex } from 'convex-test'
import { runToCompletion } from '@convex-dev/migrations'
import migrations from '@convex-dev/migrations/test'
import { describe, expect, it } from 'vitest'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { AUTHORED_SOURCE_FACTS_VERSION } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import {
  sourceImportDefinitionDtoSchema,
  sourceImportSubjectDtoSchema,
  sourceImportBootstrapInputSchema,
  authoredContentSourceDtoSchema,
  type SourceImportAuditPageDto
} from '@artificer-toolkit/schema/api/sourceImport'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import { whip } from '@artificer-toolkit/source-data/srd/equipment/whip.js'
import { halfling, lightfoot } from '@artificer-toolkit/source-data/srd/races/halfling.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { toCharacterBuilderEquipmentCatalogRecord } from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import { resolveEquipmentAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored, RaceAuthored } from '@artificer-toolkit/shared/authored'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { sourceImportBatches } from './importBatches'
import { compilePublicationDocument, parsePublicationDocument } from './publicationDocument'
import { deleteSourceFacts, readStoredSourceFacts, writeSourceFacts } from './sourceFacts'
import {
  deleteAuthoredVersion,
  insertAuthoredVersion,
  readStoredAuthoredVersionDocument
} from './documents'
import {
  importedSubject,
  setVersionCompilation,
  versionWithCompilation
} from '../../tests/fixtures/publication'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const sourceId = SRD_CONTENT_SOURCE.id
const systemDocument = jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
const bootstrap = {
  systems: [
    {
      id: srdSystemRecord.id,
      document: systemDocument,
      checksum: checksumRuleDocument(systemDocument)
    }
  ],
  contentSource: SRD_CONTENT_SOURCE,
  catalogue: SRD_RULES_CATALOGUE
}
const definition = sourceImportDefinitionDtoSchema.parse({
  ...SRD_SENSE_DEFINITIONS[0],
  definitionFamilyKey: 'sense'
})
function subject(id = acolyte.id) {
  const document = jsonValueSchema.parse(JSON.parse(JSON.stringify({ ...acolyte, id })))
  return sourceImportSubjectDtoSchema.parse({
    subjectKind: 'BACKGROUND',
    id,
    systemId: acolyte.systemId,
    label: acolyte.label,
    checksum: checksumRuleDocument(document),
    document
  })
}
const page = {
  contentSourceId: sourceId,
  paginationOpts: { numItems: 10, cursor: null }
}

describe('internal canonical source import', () => {
  it('compiles and audits every canonical Equipment through the native current-parent path', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const subjects = srdBaselineContent.subjects.equipment.map((item) => {
      const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(item)))
      return sourceImportSubjectDtoSchema.parse({
        subjectKind: 'EQUIPMENT',
        id: item.id,
        systemId: item.systemId,
        label: item.label,
        document,
        checksum: checksumRuleDocument(document)
      })
    })
    for (const batch of sourceImportBatches(subjects))
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: batch
      })
    for (const item of subjects)
      await t.mutation(internal.content.import.syncEquipmentDerived, {
        id: item.id,
        checksum: item.checksum
      })
    let cursor: string | null = null
    let total = 0
    do {
      const result: SourceImportAuditPageDto = await t.query(internal.content.import.readSubjects, {
        contentSourceId: sourceId,
        paginationOpts: { numItems: 5, cursor }
      })
      total += result.page.length
      cursor = result.isDone ? null : result.continueCursor
    } while (cursor !== null)
    expect(total).toBe(subjects.length)
    expect(total).toBe(371)
  }, 120_000)

  it('stores a base Equipment compilation at import and replay restores it exactly', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(club)))
    const base = sourceImportSubjectDtoSchema.parse({
      subjectKind: 'EQUIPMENT',
      id: club.id,
      systemId: club.systemId,
      label: club.label,
      document,
      checksum: checksumRuleDocument(document)
    })
    const imported = { contentSourceId: sourceId, subjects: [base] }
    await t.mutation(internal.content.import.importSubjects, imported)
    await t.mutation(internal.content.catalogueSearchBackfill.backfill, {
      paginationOpts: { cursor: null, numItems: 8 }
    })
    const before = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', base.id))
        .unique()
      if (!root?.equipmentOptions?.builder) throw new Error('Missing Builder Equipment facts')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      if (!version?.compilation) throw new Error('Base Equipment compiles at import.')
      return { root, version }
    })
    expect(before.version.compilation?.authoredChecksum).toBe(base.checksum)
    // A root stored before import compiled base Equipment has no compilation; replay backfills it.
    await t.run(async (ctx) => {
      const version = await ctx.db.get(before.version._id)
      if (!version) throw new Error('Missing Equipment version.')
      await setVersionCompilation(ctx, version, undefined)
    })
    expect(await t.mutation(internal.content.import.importSubjects, imported)).toEqual({
      inserted: 0,
      reused: 1,
      replaced: 0
    })
    expect(
      await t.run(async (ctx) => ({
        root: await ctx.db.get(before.root._id),
        version: await versionWithCompilation(ctx, await ctx.db.get(before.version._id))
      }))
    ).toEqual(before)
  })

  it('compiles Equipment after unordered parent import and only backfills exact missing evidence', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const [base, variant] = [club, clubPlus1].map((item) => {
      const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(item)))
      return sourceImportSubjectDtoSchema.parse({
        subjectKind: 'EQUIPMENT',
        id: item.id,
        systemId: item.systemId,
        label: item.label,
        document,
        checksum: checksumRuleDocument(document)
      })
    })
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: sourceId,
      subjects: [variant]
    })
    const sync = { id: variant.id, checksum: variant.checksum }
    await expect(t.mutation(internal.content.import.syncEquipmentDerived, sync)).rejects.toThrow(
      'Readable parent Equipment'
    )
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: sourceId,
      subjects: [base]
    })
    const unsynced = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', variant.id))
        .unique()
      if (!root?.equipmentOptions) throw new Error('Missing raw Equipment facts')
      return root.equipmentOptions
    })
    expect(unsynced.builder).toBeUndefined()
    for (const item of [base, variant])
      await t.mutation(internal.content.import.syncEquipmentDerived, {
        id: item.id,
        checksum: item.checksum
      })
    const before = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', variant.id))
        .unique()
      if (!root) throw new Error('Missing Equipment fixture')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      if (!version?.compilation) throw new Error('Missing Equipment compilation')
      return { root, version }
    })
    const projection = JSON.parse(before.version.compilation!.projectionJson)
    if (!('weight' in club)) throw new Error('Expected base Club fixture')
    expect(projection.category).toBe(club.category)
    expect(projection.weight).toEqual(club.weight)
    expect(before.root.parentEquipmentId).toBe(club.id)
    expect(before.version.compilation!.authoredChecksum).toBe(variant.checksum)
    expect(before.version.compilation!.projectionChecksum).toBe(checksumRuleDocument(projection))
    const variantDocument = equipmentAuthoredDtoSchema.parse(variant.document)
    const baseDocument = equipmentAuthoredDtoSchema.parse(base.document)
    const {
      id: _id,
      label: _label,
      ...builder
    } = toCharacterBuilderEquipmentCatalogRecord(
      resolveEquipmentAuthored(variantDocument as EquipmentAuthored, (id) =>
        id === base.id ? (baseDocument as EquipmentAuthored) : undefined
      )
    )
    expect(before.root.equipmentOptions?.builder).toEqual({
      version: 1,
      parentEquipmentId: base.id,
      ...builder
    })
    const imported = { contentSourceId: sourceId, subjects: [variant, base] }
    expect(await t.mutation(internal.content.import.importSubjects, imported)).toEqual({
      inserted: 0,
      reused: 2,
      replaced: 0
    })
    expect(
      await t.run(async (ctx) => versionWithCompilation(ctx, await ctx.db.get(before.version._id)))
    ).toEqual(before.version)
    await t.run(async (ctx) => {
      if (!before.root.equipmentOptions) throw new Error('Missing Equipment facts')
      const { builder: _builder, ...rawFacts } = before.root.equipmentOptions
      await ctx.db.patch(before.root._id, { equipmentOptions: rawFacts })
    })
    await t.mutation(internal.content.import.importSubjects, imported)
    expect(await t.run((ctx) => ctx.db.get(before.root._id))).toEqual(before.root)
    await t.run(async (ctx) => {
      if (!before.root.equipmentOptions?.builder) throw new Error('Missing Builder facts')
      await ctx.db.patch(before.root._id, {
        equipmentOptions: {
          ...before.root.equipmentOptions,
          builder: {
            ...before.root.equipmentOptions.builder,
            requiresAttunement: !before.root.equipmentOptions.builder.requiresAttunement
          }
        }
      })
    })
    await expect(t.mutation(internal.content.import.importSubjects, imported)).rejects.toThrow(
      'Canonical content conflict'
    )
    await t.run((ctx) =>
      ctx.db.patch(before.root._id, {
        equipmentOptions: before.root.equipmentOptions
      })
    )
    expect((await t.query(internal.content.import.readSubjects, page)).page).toHaveLength(2)
    await t.run((ctx) => ctx.db.patch(before.root._id, { parentEquipmentId: undefined }))
    await t.mutation(internal.content.import.importSubjects, imported)
    expect(await t.run((ctx) => ctx.db.get(before.root._id))).toEqual(before.root)
    await t.run((ctx) => ctx.db.patch(before.root._id, { parentEquipmentId: null }))
    await expect(t.mutation(internal.content.import.importSubjects, imported)).rejects.toThrow(
      'Canonical content conflict'
    )
    await t.run((ctx) => ctx.db.patch(before.root._id, { parentEquipmentId: club.id }))
    await t.run((ctx) =>
      setVersionCompilation(ctx, before.version, {
        ...before.version.compilation!,
        projectionChecksum: '0'.repeat(64)
      })
    )
    await expect(t.mutation(internal.content.import.syncEquipmentDerived, sync)).rejects.toThrow(
      'Canonical content conflict'
    )
    await expect(t.query(internal.content.import.readSubjects, page)).rejects.toThrow(
      'Canonical content conflict'
    )
    await t.run((ctx) => setVersionCompilation(ctx, before.version, undefined))
    await t.mutation(internal.content.import.syncEquipmentDerived, sync)
    expect(
      await t.run(async (ctx) => versionWithCompilation(ctx, await ctx.db.get(before.version._id)))
    ).toEqual(before.version)
  })

  it('audits large Class payloads with complete one-document pagination', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const subjects = [...srdBaselineContent.subjects.classes]
      .sort((left, right) => JSON.stringify(right).length - JSON.stringify(left).length)
      .slice(0, 2)
      .map((item) => {
        const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(item)))
        return {
          subjectKind: 'CLASS' as const,
          id: item.id,
          systemId: item.systemId,
          label: item.label,
          document,
          checksum: checksumRuleDocument(document)
        }
      })
    for (const subject of subjects)
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [subject]
      })
    for (const subject of subjects) {
      const parsed = parsePublicationDocument('CLASS', subject.document)
      await t.mutation(internal.content.import.syncClassDerived, {
        id: subject.id,
        checksum: subject.checksum,
        parentClassId:
          parsed.document.category === 'SUBCLASS' ? parsed.document.parentClassId : null,
        compilation: compilePublicationDocument(parsed)
      })
    }
    const first = await t.query(internal.content.import.readSubjects, {
      contentSourceId: sourceId,
      paginationOpts: { numItems: 1, cursor: null }
    })
    expect(first.page).toHaveLength(1)
    expect(first.isDone).toBe(false)
    const second = await t.query(internal.content.import.readSubjects, {
      contentSourceId: sourceId,
      paginationOpts: { numItems: 1, cursor: first.continueCursor }
    })
    expect(second.page).toHaveLength(1)
    expect(second.isDone).toBe(true)
    expect([...first.page, ...second.page].map((item) => item.id).sort()).toEqual(
      subjects.map((item) => item.id).sort()
    )
  })

  it('backfills master and owned current roots without rewriting content, identities, or counts', async () => {
    const t = convexTest(schema, modules)
    migrations.register(t)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const owned = subject('10000000-0000-4000-8000-000000000001')
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: sourceId,
      subjects: [subject(), owned]
    })
    const expected = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', owned.id))
        .unique()
      const ownedFacts = root && (await readStoredSourceFacts(ctx, root))
      if (!root || !ownedFacts) throw new Error('Missing owned fixture')
      const ownerUserId = '10000000-0000-4000-8000-000000000002'
      const contentSourceId = '10000000-0000-4000-8000-000000000003'
      const document = { ...acolyte, id: owned.id, userId: ownerUserId }
      const checksum = checksumRuleDocument(document)
      await ctx.db.insert('contentSources', {
        id: contentSourceId,
        gameSystemId: acolyte.systemId,
        kind: 'USER',
        ownerUserId,
        code: 'default',
        label: 'Homebrew',
        description: ''
      })
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      if (!version) throw new Error('Missing owned fixture version')
      await deleteAuthoredVersion(ctx, version)
      const currentVersionId = await insertAuthoredVersion(
        ctx,
        {
          subjectKind: version.subjectKind,
          id: version.id,
          systemId: version.systemId,
          label: version.label,
          checksum,
          contentSourceId,
          versionId: version.versionId,
          version: version.version,
          documentSchemaVersion: version.documentSchemaVersion
        },
        canonicalizeRuleDocument(document),
        version.compilation
      )
      await ctx.db.patch(root._id, {
        ownerUserId,
        contentSourceId,
        checksum,
        currentVersionId
      })
      await writeSourceFacts(ctx, root.id, { ...ownedFacts, checksum })
      return {
        roots: await ctx.db.query('authoredRoots').withIndex('by_publicId').take(3),
        sourceFacts: await ctx.db.query('authoredSourceFacts').take(3),
        versions: await ctx.db.query('authoredVersions').withIndex('by_id_version').take(3),
        counts: await ctx.db.query('authoredCatalogueCounts').withIndex('by_source_kind').take(3)
      }
    })
    await t.run(async (ctx) => {
      for (const root of expected.roots) await deleteSourceFacts(ctx, root.id)
    })
    for (let replay = 0; replay < 2; replay++) {
      const status = await t.run((ctx) =>
        runToCompletion(
          ctx,
          components.migrations,
          internal.content.sourceMigrations.backfillAuthoringSources,
          { cursor: null }
        )
      )
      expect(status).toMatchObject({ isDone: true, processed: 2 })
    }
    expect(
      await t.run(async (ctx) => ({
        roots: await ctx.db.query('authoredRoots').withIndex('by_publicId').take(3),
        sourceFacts: await ctx.db.query('authoredSourceFacts').take(3),
        versions: await ctx.db.query('authoredVersions').withIndex('by_id_version').take(3),
        counts: await ctx.db.query('authoredCatalogueCounts').withIndex('by_source_kind').take(3)
      }))
    ).toMatchObject({
      roots: expected.roots,
      versions: expected.versions,
      counts: expected.counts,
      sourceFacts: expected.sourceFacts.map(({ subjectId, facts }) => ({ subjectId, facts }))
    })
  })

  it('rolls back an entire migration batch if existing source facts conflict', async () => {
    const t = convexTest(schema, modules)
    migrations.register(t)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: sourceId,
      subjects: [subject(), subject('10000000-0000-4000-8000-000000000001')]
    })
    const before = await t.run(async (ctx) => {
      const roots = await ctx.db.query('authoredRoots').withIndex('by_publicId').take(3)
      await deleteSourceFacts(ctx, roots[0].id)
      await writeSourceFacts(ctx, roots[1].id, {
        checksum: roots[1].checksum,
        factsVersion: AUTHORED_SOURCE_FACTS_VERSION,
        rows: {}
      })
      return {
        roots: await ctx.db.query('authoredRoots').withIndex('by_publicId').take(3),
        sourceFacts: await ctx.db.query('authoredSourceFacts').take(3)
      }
    })
    await expect(
      t.run((ctx) =>
        runToCompletion(
          ctx,
          components.migrations,
          internal.content.sourceMigrations.backfillAuthoringSources,
          { batchSize: 2 }
        )
      )
    ).rejects.toThrow('Stored authoring source facts conflict.')
    expect(
      await t.run(async (ctx) => ({
        roots: await ctx.db.query('authoredRoots').withIndex('by_publicId').take(3),
        sourceFacts: await ctx.db.query('authoredSourceFacts').take(3)
      }))
    ).toEqual(before)
  })

  it('backfills only absent exact authoring sources and rejects conflicting facts atomically', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const input = { contentSourceId: sourceId, subjects: [subject()] }
    await t.mutation(internal.content.import.importSubjects, input)
    const { root, facts } = await t.run(async (ctx) => {
      const found = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
        .unique()
      return { root: found, facts: found && (await readStoredSourceFacts(ctx, found)) }
    })
    if (!root || !facts) throw new Error('Missing projected source fixture')
    await t.run((ctx) => deleteSourceFacts(ctx, root.id))
    await expect(t.query(internal.content.import.readSubjects, page)).rejects.toThrow()
    expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
      inserted: 0,
      reused: 1,
      replaced: 0
    })
    expect(await t.run((ctx) => ctx.db.get(root._id))).toEqual(root)
    expect(await t.run((ctx) => readStoredSourceFacts(ctx, root))).toEqual(facts)
    expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
      inserted: 0,
      reused: 1,
      replaced: 0
    })
    await t.run((ctx) =>
      writeSourceFacts(ctx, root.id, {
        ...facts,
        rows: {
          ...facts.rows,
          backgrounds: [{ id: root.id, label: 'Incorrect projection' }]
        }
      })
    )
    const unchanged = await t.run((ctx) => ctx.db.get(root._id))
    const unchangedFacts = await t.run((ctx) => readStoredSourceFacts(ctx, root))
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        ...input,
        subjects: [subject('10000000-0000-4000-8000-000000000001'), subject()]
      })
    ).rejects.toThrow('Canonical content conflict.')
    expect(await t.run((ctx) => ctx.db.query('authoredRoots').take(3))).toEqual([unchanged])
    expect(await t.run((ctx) => readStoredSourceFacts(ctx, root))).toEqual(unchangedFacts)
    await expect(t.query(internal.content.import.readSubjects, page)).rejects.toThrow(
      'Canonical content conflict.'
    )
  })

  it('re-derives canonical source facts that an older or unversioned derivation stored', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const input = { contentSourceId: sourceId, subjects: [subject()] }
    await t.mutation(internal.content.import.importSubjects, input)
    const { root, facts } = await t.run(async (ctx) => {
      const found = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
        .unique()
      return { root: found, facts: found && (await readStoredSourceFacts(ctx, found)) }
    })
    if (!root || !facts) throw new Error('Missing projected source fixture')
    expect(facts.factsVersion).toBe(AUTHORED_SOURCE_FACTS_VERSION)
    const tables = Object.keys(facts.rows)
    expect(tables.length).toBeGreaterThan(1)
    // An older derivation produced no rows for a table the current one derives, and no version.
    await t.run((ctx) =>
      writeSourceFacts(ctx, root.id, {
        checksum: facts.checksum,
        rows: Object.fromEntries(
          Object.entries(facts.rows).filter(([table]) => table !== tables.at(-1))
        )
      })
    )
    expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
      inserted: 0,
      reused: 1,
      replaced: 0
    })
    expect(await t.run((ctx) => ctx.db.get(root._id))).toEqual(root)
    expect(await t.run((ctx) => readStoredSourceFacts(ctx, root))).toEqual(facts)
  })

  it('backfills catalogue metadata and counts exactly once, rejecting stale metadata', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const input = { contentSourceId: sourceId, subjects: [subject()] }
    await t.mutation(internal.content.import.importSubjects, input)
    const before = await t.run(async (ctx) => ({
      root: await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
        .unique(),
      counts: await ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) =>
          q.eq('contentSourceId', sourceId).eq('subjectKind', 'BACKGROUND')
        )
        .unique()
    }))
    if (!before.root?.catalogue || !before.counts) throw new Error('Missing fixture')
    await t.run(async (ctx) => {
      await ctx.db.patch(before.root!._id, { catalogue: undefined })
      await ctx.db.delete(before.counts!._id)
      const ownerCounts = await ctx.db
        .query('authoredCatalogueOwnerCounts')
        .withIndex('by_subjectKind_ownerUserId', (q) =>
          q.eq('subjectKind', 'BACKGROUND').eq('ownerUserId', undefined)
        )
        .unique()
      if (!ownerCounts) throw new Error('Missing owner count fixture')
      await ctx.db.delete(ownerCounts._id)
    })
    for (let replay = 0; replay < 2; replay++) {
      expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
        inserted: 0,
        reused: 1,
        replaced: 0
      })
    }
    const after = await t.run(async (ctx) => ({
      root: await ctx.db.get(before.root!._id),
      counts: await ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) =>
          q.eq('contentSourceId', sourceId).eq('subjectKind', 'BACKGROUND')
        )
        .unique()
    }))
    expect(after.root?.catalogue).toEqual(before.root.catalogue)
    expect(after.counts?.count).toBe(1)
    await t.run((ctx) =>
      ctx.db.patch(before.root!._id, {
        catalogue: { ...before.root!.catalogue!, description: 'corrupted' }
      })
    )
    await expect(t.mutation(internal.content.import.importSubjects, input)).rejects.toThrow(
      'Canonical content conflict.'
    )
    await expect(t.query(internal.content.import.readSubjects, page)).rejects.toThrow(
      'Canonical content conflict.'
    )
  })

  it('backfills only missing exact Background compilation and rejects conflicting evidence', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const input = { contentSourceId: sourceId, subjects: [subject()] }
    await t.mutation(internal.content.import.importSubjects, input)
    const version = await t.run(async (ctx) =>
      versionWithCompilation(
        ctx,
        await ctx.db
          .query('authoredVersions')
          .withIndex('by_id_version', (q) => q.eq('id', acolyte.id).eq('version', 1))
          .unique()
      )
    )
    if (!version?.compilation) throw new Error('Missing compiled Background fixture')
    const compilation = version.compilation
    await t.run((ctx) => setVersionCompilation(ctx, version, undefined))
    expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
      inserted: 0,
      reused: 1,
      replaced: 0
    })
    expect(
      await t.run(async (ctx) => versionWithCompilation(ctx, await ctx.db.get(version._id)))
    ).toEqual(version)
    await t.run((ctx) =>
      setVersionCompilation(ctx, version, {
        ...compilation,
        projectionChecksum: '0'.repeat(64)
      })
    )
    await expect(t.mutation(internal.content.import.importSubjects, input)).rejects.toThrow(
      'Canonical content conflict.'
    )
    await expect(t.query(internal.content.import.readSubjects, page)).rejects.toThrow(
      'Canonical content conflict.'
    )
  })

  it('admits owned provenance without allowing canonical import into a USER source', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const ownedSource = {
      ...SRD_CONTENT_SOURCE,
      id: crypto.randomUUID(),
      kind: 'USER' as const,
      ownerUserId: crypto.randomUUID()
    }
    expect(authoredContentSourceDtoSchema.safeParse(ownedSource).success).toBe(true)
    for (const field of ['id', 'ownerUserId']) {
      expect(
        authoredContentSourceDtoSchema.safeParse({
          ...ownedSource,
          [field]: '10000000-0000-0000-0000-000000000001'
        }).success
      ).toBe(false)
    }
    expect(
      authoredContentSourceDtoSchema.safeParse({
        ...ownedSource,
        ownerUserId: null
      }).success
    ).toBe(false)
    expect(
      authoredContentSourceDtoSchema.safeParse({
        ...ownedSource,
        kind: 'PLATFORM'
      }).success
    ).toBe(false)
    expect(
      sourceImportBootstrapInputSchema.safeParse({
        ...bootstrap,
        contentSource: ownedSource
      }).success
    ).toBe(false)
    await t.run((ctx) => ctx.db.insert('contentSources', ownedSource))
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: ownedSource.id,
        subjects: [subject()]
      })
    ).rejects.toThrow('Missing platform content source.')
    expect(await t.run((ctx) => ctx.db.query('authoredRoots').take(1))).toHaveLength(0)
  })

  it('inserts once and reuses exact source, versions, and definitions without mutation', async () => {
    const t = convexTest(schema, modules)
    expect(await t.mutation(internal.content.import.bootstrap, bootstrap)).toEqual({
      inserted: 3,
      reused: 0,
      replaced: 0
    })
    expect(await t.mutation(internal.content.import.bootstrap, bootstrap)).toEqual({
      inserted: 0,
      reused: 3,
      replaced: 0
    })
    const input = { contentSourceId: sourceId, subjects: [subject()] }
    expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
      inserted: 1,
      reused: 0,
      replaced: 0
    })
    const before = await t.run(async (ctx) => {
      const versions = await ctx.db.query('authoredVersions').take(10)
      const version = versions[0]
      if (!version) throw new Error('Missing imported version')
      return {
        versions,
        document: await readStoredAuthoredVersionDocument(ctx, version)
      }
    })
    expect(before.document).toEqual(input.subjects[0].document)
    expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
      inserted: 0,
      reused: 1,
      replaced: 0
    })
    expect(await t.run((ctx) => ctx.db.query('authoredVersions').take(10))).toEqual(before.versions)
    const definitions = {
      contentSourceId: sourceId,
      definitions: [definition]
    }
    expect(await t.mutation(internal.content.import.importDefinitions, definitions)).toEqual({
      inserted: 1,
      reused: 0,
      replaced: 0
    })
    expect(await t.mutation(internal.content.import.importDefinitions, definitions)).toEqual({
      inserted: 0,
      reused: 1,
      replaced: 0
    })
    expect((await t.query(internal.content.import.readSubjects, page)).page).toEqual(
      input.subjects.map((value) => ({
        id: value.id,
        checksum: checksumRuleDocument(value)
      }))
    )
    expect((await t.query(internal.content.import.readDefinitions, page)).page).toEqual([
      { id: definition.id, checksum: checksumRuleDocument(definition) }
    ])
  })

  it('replaces a changed subject in place, including a downgrade, without leaving old versions or chunks', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const original = subject()
    const document = jsonValueSchema.parse({
      ...JSON.parse(JSON.stringify(acolyte)),
      label: 'Temple Acolyte'
    })
    const renamed = sourceImportSubjectDtoSchema.parse({
      ...original,
      label: 'Temple Acolyte',
      checksum: checksumRuleDocument(document),
      document
    })
    const state = () =>
      t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
          .unique()
        const versions = await ctx.db.query('authoredVersions').take(10)
        return {
          label: root?.label,
          checksum: root?.checksum,
          versions: versions.map((version) => [version.version, version.checksum]),
          chunks: (await ctx.db.query('authoredVersionPayloadChunks').take(50)).length,
          compilations: (await ctx.db.query('authoredVersionCompilations').take(10)).length
        }
      })
    const batch = (value: typeof original) => ({ contentSourceId: sourceId, subjects: [value] })

    await t.mutation(internal.content.import.importSubjects, batch(original))
    const first = await state()
    expect(await t.mutation(internal.content.import.importSubjects, batch(renamed))).toEqual({
      inserted: 0,
      reused: 0,
      replaced: 1
    })
    expect(await state()).toEqual({
      ...first,
      label: 'Temple Acolyte',
      checksum: renamed.checksum,
      versions: [[2, renamed.checksum]]
    })
    // Seeding is declarative: an older corpus is just another replace.
    expect(await t.mutation(internal.content.import.importSubjects, batch(original))).toEqual({
      inserted: 0,
      reused: 0,
      replaced: 1
    })
    expect(await state()).toEqual({ ...first, versions: [[3, original.checksum]] })
    expect((await t.query(internal.content.import.readSubjectChecksums, page)).page).toEqual([
      { id: acolyte.id, checksum: original.checksum }
    ])
  })

  it('recompiles dependent subraces on a parent Race replace and refuses to demote a Race with subraces', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const toSubject = (item: RaceAuthored) =>
      importedSubject({
        subjectKind: 'RACE',
        id: item.id,
        systemId: item.systemId,
        label: item.label,
        document: item
      })
    const [base, child] = [halfling, lightfoot].map(toSubject)
    for (const item of [base, child]) {
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [item]
      })
      await t.mutation(internal.content.raceRelationships.syncDerived, {
        id: item.id,
        checksum: item.checksum
      })
    }

    const renamed = toSubject({ ...halfling, label: 'Halfling Kin' })
    expect(
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [renamed]
      })
    ).toEqual({ inserted: 0, reused: 0, replaced: 1 })
    // The strict derived sync proves the subrace was recompiled against the replaced parent.
    await t.mutation(internal.content.raceRelationships.syncDerived, {
      id: child.id,
      checksum: child.checksum
    })
    const family = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', child.id))
        .unique()
      return root?.catalogueFamily
    })
    expect(family).toEqual({ id: halfling.id, nameKey: 'halfling kin' })

    const demoted = toSubject({ ...lightfoot, id: halfling.id, label: 'Halfling' })
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [demoted]
      })
    ).rejects.toThrow(`Subraces: ${child.id}.`)
  })

  it('recompiles variant Equipment against a replaced parent', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const toSubject = (item: EquipmentAuthored) =>
      importedSubject({
        subjectKind: 'EQUIPMENT',
        id: item.id,
        systemId: item.systemId,
        label: item.label,
        document: item
      })
    if (!('weight' in club) || !('weight' in whip)) throw new Error('Expected base fixtures')
    const [base, variant] = [club, clubPlus1].map(toSubject)
    for (const item of [base, variant]) {
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [item]
      })
      await t.mutation(internal.content.import.syncEquipmentDerived, {
        id: item.id,
        checksum: item.checksum
      })
    }

    expect(
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [toSubject({ ...club, weight: whip.weight })]
      })
    ).toEqual({ inserted: 0, reused: 0, replaced: 1 })
    // The strict derived sync proves the variant was recompiled against the replaced parent.
    await t.mutation(internal.content.import.syncEquipmentDerived, {
      id: variant.id,
      checksum: variant.checksum
    })
    const projection = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', variant.id))
        .unique()
      const stored = await versionWithCompilation(
        ctx,
        root && (await ctx.db.get(root.currentVersionId))
      )
      return JSON.parse(stored?.compilation?.projectionJson ?? 'null')
    })
    expect(projection.weight).toEqual(whip.weight)
  })

  // T1a2: a retired rule kind left stored canonical dependents that the current schema rejects.
  async function storeRetiredShape(t: TestConvex<typeof schema>, id: string) {
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
      if (!root) throw new Error('Missing dependent fixture')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      if (!version) throw new Error('Missing dependent fixture version')
      const document = jsonValueSchema.parse({
        ...(await deleteAuthoredVersion(ctx, version)),
        features: [{ retiredRuleKind: 'RETIRED' }]
      })
      const checksum = checksumRuleDocument(document)
      // A version of the older document, as the seed stored it.
      const versionId = crypto.randomUUID()
      const currentVersionId = await insertAuthoredVersion(
        ctx,
        {
          subjectKind: version.subjectKind,
          id: version.id,
          systemId: version.systemId,
          label: version.label,
          checksum,
          contentSourceId: version.contentSourceId,
          versionId,
          version: version.version,
          documentSchemaVersion: version.documentSchemaVersion
        },
        canonicalizeRuleDocument(document),
        version.compilation
      )
      await ctx.db.patch(root._id, {
        checksum,
        currentVersionId,
        currentVersionPublicId: versionId
      })
      const stored = await readStoredSourceFacts(ctx, root)
      if (stored) await writeSourceFacts(ctx, root.id, { ...stored, checksum })
    })
  }

  it('replaces a Race family whose stored subrace predates the current schema in one seed', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const toSubject = (item: RaceAuthored) =>
      importedSubject({
        subjectKind: 'RACE',
        id: item.id,
        systemId: item.systemId,
        label: item.label,
        document: item
      })
    const [base, child] = [halfling, lightfoot].map(toSubject)
    for (const item of [base, child]) {
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [item]
      })
      await t.mutation(internal.content.raceRelationships.syncDerived, {
        id: item.id,
        checksum: item.checksum
      })
    }
    await storeRetiredShape(t, child.id)

    expect(
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [toSubject({ ...halfling, label: 'Halfling Kin' })],
        reimportedSubjectIds: [child.id]
      })
    ).toEqual({ inserted: 0, reused: 0, replaced: 1 })
    expect(
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [child]
      })
    ).toEqual({ inserted: 0, reused: 0, replaced: 1 })
    // The strict derived sync proves the subrace was compiled against the replaced parent.
    await t.mutation(internal.content.raceRelationships.syncDerived, {
      id: child.id,
      checksum: child.checksum
    })
  })

  it('replaces an Equipment family whose stored variant predates the current schema in one seed', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const toSubject = (item: EquipmentAuthored) =>
      importedSubject({
        subjectKind: 'EQUIPMENT',
        id: item.id,
        systemId: item.systemId,
        label: item.label,
        document: item
      })
    if (!('weight' in club) || !('weight' in whip)) throw new Error('Expected base fixtures')
    const [base, variant] = [club, clubPlus1].map(toSubject)
    for (const item of [base, variant]) {
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [item]
      })
      await t.mutation(internal.content.import.syncEquipmentDerived, {
        id: item.id,
        checksum: item.checksum
      })
    }
    await storeRetiredShape(t, variant.id)

    expect(
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [toSubject({ ...club, weight: whip.weight })],
        reimportedSubjectIds: [variant.id]
      })
    ).toEqual({ inserted: 0, reused: 0, replaced: 1 })
    expect(
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [variant]
      })
    ).toEqual({ inserted: 0, reused: 0, replaced: 1 })
    // The strict derived sync proves the variant was compiled against the replaced parent.
    await t.mutation(internal.content.import.syncEquipmentDerived, {
      id: variant.id,
      checksum: variant.checksum
    })
  })

  it('refuses a parent replace whose stored dependent outside the seed predates the current schema, naming it', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const toSubject = (item: RaceAuthored) =>
      importedSubject({
        subjectKind: 'RACE',
        id: item.id,
        systemId: item.systemId,
        label: item.label,
        document: item
      })
    for (const item of [halfling, lightfoot].map(toSubject))
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [item]
      })
    await storeRetiredShape(t, lightfoot.id)

    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [toSubject({ ...halfling, label: 'Halfling Kin' })]
      })
    ).rejects.toThrow(`Stored RACE ${lightfoot.id} does not match its current schema at features`)
  })

  it('refuses a replayed subject whose document changed under its old checksum, and replaces it under a new one', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const original = subject()
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: sourceId,
      subjects: [original]
    })
    const before = await t.run(async (ctx) => ({
      roots: await ctx.db.query('authoredRoots').take(10),
      versions: await ctx.db.query('authoredVersions').take(10)
    }))
    const document = jsonValueSchema.parse({
      ...acolyte,
      details: acolyte.details?.map((detail, index) =>
        index === 0 ? { ...detail, description: `${detail.description} Changed.` } : detail
      )
    })
    const staleChecksum = { ...original, document }
    const newChecksum = { ...original, document, checksum: checksumRuleDocument(document) }
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [staleChecksum]
      })
    ).rejects.toThrow('Canonical content conflict.')
    expect(
      await t.run(async (ctx) => ({
        roots: await ctx.db.query('authoredRoots').take(10),
        versions: await ctx.db.query('authoredVersions').take(10)
      }))
    ).toEqual(before)
    // D120: a new checksum is a corpus change, so it is replaced in place rather than refused.
    expect(
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [newChecksum]
      })
    ).toEqual({ inserted: 0, reused: 0, replaced: 1 })
    const after = await t.run(async (ctx) => ({
      roots: await ctx.db.query('authoredRoots').take(10),
      versions: await ctx.db.query('authoredVersions').take(10)
    }))
    expect(after.roots.map((root) => root.checksum)).toEqual([newChecksum.checksum])
    expect(after.versions.map((version) => [version.version, version.checksum])).toEqual([
      [2, newChecksum.checksum]
    ])
  })

  it('replaces a changed System, content source and catalogue in place and advances the vocabulary snapshot', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const revised = jsonValueSchema.parse(
      JSON.parse(JSON.stringify({ ...srdSystemRecord, description: 'Revised SRD' }))
    )
    const next = {
      systems: [
        { id: srdSystemRecord.id, document: revised, checksum: checksumRuleDocument(revised) }
      ],
      contentSource: { ...SRD_CONTENT_SOURCE, label: 'Revised source' },
      catalogue: { ...SRD_RULES_CATALOGUE, description: 'Revised catalogue' }
    }
    expect(await t.mutation(internal.content.import.bootstrap, next)).toEqual({
      inserted: 0,
      reused: 0,
      replaced: 3
    })
    const stored = await t.run(async (ctx) => ({
      system: await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
        .unique(),
      source: await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', sourceId))
        .unique(),
      catalogue: await ctx.db
        .query('rulesCatalogues')
        .withIndex('by_publicId', (q) => q.eq('id', SRD_RULES_CATALOGUE.id))
        .unique(),
      snapshots: await ctx.db
        .query('systemVocabularySnapshots')
        .withIndex('by_systemId_snapshotVersion', (q) => q.eq('systemId', srdSystemRecord.id))
        .collect()
    }))
    expect(stored.system?.document).toEqual(revised)
    expect(stored.system?.checksum).toBe(next.systems[0].checksum)
    expect(stored.source?.label).toBe('Revised source')
    expect(stored.catalogue?.description).toBe('Revised catalogue')
    // Earlier snapshot versions stay as the record Encounters pinned them against.
    expect(stored.snapshots.map((snapshot) => snapshot.snapshotVersion)).toEqual([1, 2])
    expect(stored.snapshots[1]?.document).toEqual(revised)
    expect(await t.mutation(internal.content.import.bootstrap, next)).toEqual({
      inserted: 0,
      reused: 3,
      replaced: 0
    })
    expect(await t.run((ctx) => ctx.db.query('systemVocabularySnapshots').take(10))).toHaveLength(2)
  })

  it('refuses a System replacement that removes a vocabulary entry stored data may name', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const removed = srdSystemRecord.languages[0]
    const trimmed = jsonValueSchema.parse(
      JSON.parse(
        JSON.stringify({ ...srdSystemRecord, languages: srdSystemRecord.languages.slice(1) })
      )
    )
    await expect(
      t.mutation(internal.content.import.bootstrap, {
        ...bootstrap,
        systems: [
          { id: srdSystemRecord.id, document: trimmed, checksum: checksumRuleDocument(trimmed) }
        ]
      })
    ).rejects.toThrow(`removes vocabulary entries stored data may name: ${removed.id}`)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('systems')
          .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
          .unique()
      )
    ).toMatchObject({ document: systemDocument })
  })

  it('replaces a changed definition in place and refuses to change its identity', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const input = { contentSourceId: sourceId, definitions: [definition] }
    await t.mutation(internal.content.import.importDefinitions, input)
    const document = jsonValueSchema.parse({
      ...(definition.document as Record<string, unknown>),
      capabilities: (
        definition.document as { capabilities: Record<string, unknown>[] }
      ).capabilities.map((capability) => ({ ...capability, perceivesInvisible: true }))
    })
    const next = sourceImportDefinitionDtoSchema.parse({
      ...definition,
      label: 'Revised sense',
      description: 'Revised description',
      checksum: checksumRuleDocument(document),
      document
    })
    expect(
      await t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: sourceId,
        definitions: [next]
      })
    ).toEqual({ inserted: 0, reused: 0, replaced: 1 })
    const [row] = await t.run((ctx) => ctx.db.query('reusableDefinitions').take(10))
    expect(row).toMatchObject({
      id: definition.id,
      label: 'Revised sense',
      description: 'Revised description',
      checksum: next.checksum,
      version: 1
    })
    expect(await t.query(internal.content.import.readDefinitions, page)).toMatchObject({
      page: [{ id: definition.id, checksum: checksumRuleDocument(next) }]
    })
    expect(
      await t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: sourceId,
        definitions: [next]
      })
    ).toEqual({ inserted: 0, reused: 1, replaced: 0 })
    await t.run(async (ctx) => {
      await ctx.db.patch(row._id, { definitionFamilyKey: 'rule-capability' })
    })
    await expect(
      t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: sourceId,
        definitions: [{ ...next, label: 'Another label' }]
      })
    ).rejects.toThrow('Canonical content conflict.')
  })

  it('backfills the publication metadata a definition was seeded without, and refuses a different one', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const input = { contentSourceId: sourceId, definitions: [definition] }
    await t.mutation(internal.content.import.importDefinitions, input)
    const [seeded] = await t.run((ctx) => ctx.db.query('reusableDefinitions').take(10))
    await t.run((ctx) =>
      ctx.db.patch(seeded._id, {
        contractVersion: undefined,
        publishedAt: undefined,
        publishedBy: undefined
      })
    )

    expect(await t.mutation(internal.content.import.importDefinitions, input)).toEqual({
      inserted: 0,
      reused: 1,
      replaced: 0
    })
    const [backfilled] = await t.run((ctx) => ctx.db.query('reusableDefinitions').take(10))
    expect(backfilled).toMatchObject({
      contractVersion: seeded.contractVersion,
      publishedBy: seeded.publishedBy,
      publishedAt: expect.any(String)
    })
    await t.run((ctx) => ctx.db.patch(seeded._id, { publishedBy: 'another-owner' }))
    await expect(t.mutation(internal.content.import.importDefinitions, input)).rejects.toThrow(
      'Canonical content conflict.'
    )
  })

  it('rejects an identity change in bootstrap metadata and leaves the original untouched', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    await expect(
      t.mutation(internal.content.import.bootstrap, {
        ...bootstrap,
        contentSource: { ...SRD_CONTENT_SOURCE, code: 'CHANGED' }
      })
    ).rejects.toThrow('Canonical content conflict')
    expect(
      await t.query(internal.content.import.readBootstrap, {
        systemIds: [srdSystemRecord.id],
        contentSourceId: sourceId,
        catalogueId: SRD_RULES_CATALOGUE.id
      })
    ).toEqual({
      ...bootstrap,
      systems: bootstrap.systems.map((value) => ({
        id: value.id,
        checksum: checksumRuleDocument(value)
      }))
    })
  })

  it('rolls back a whole batch when a later record has a forged checksum', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const invalid = {
      ...subject('10000000-0000-4000-8000-000000000002'),
      checksum: '0'.repeat(64)
    }
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [subject(), invalid]
      })
    ).rejects.toThrow('checksum mismatch')
    expect(await t.run((ctx) => ctx.db.query('authoredRoots').take(10))).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('authoredVersions').take(10))).toEqual([])
  })

  it('rolls back a whole batch when a later new document has a key its schema does not define', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const valid = subject('10000000-0000-4000-8000-000000000002')
    const document = { ...acolyte, id: valid.id, unknownKey: 'rejected by the schema parse' }
    const invalid = { ...valid, document, checksum: checksumRuleDocument(document) }
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [subject(), invalid]
      })
    ).rejects.toThrow('unrecognized_key')
    expect(await t.run((ctx) => ctx.db.query('authoredRoots').take(10))).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('authoredVersions').take(10))).toEqual([])
  })

  it('rejects malformed identities, duplicate IDs, missing document fields, and wrong Systems', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    for (const invalid of [
      { ...subject(), id: 'not-a-uuid' },
      { ...subject(), systemId: '10000000-0000-4000-8000-000000000099' },
      { ...subject(), document: { id: acolyte.id } }
    ]) {
      await expect(
        t.mutation(internal.content.import.importSubjects, {
          contentSourceId: sourceId,
          subjects: [invalid]
        })
      ).rejects.toThrow()
    }
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [subject(), subject()]
      })
    ).rejects.toThrow('Duplicate import UUID')
    await expect(
      t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: sourceId,
        definitions: [{ ...definition, checksum: '0'.repeat(64) }]
      })
    ).rejects.toThrow('checksum mismatch')
    expect(await t.run((ctx) => ctx.db.query('authoredRoots').take(10))).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('reusableDefinitions').take(10))).toEqual([])
  })

  it('rejects a foreign current-version pointer instead of auditing another record', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    const second = subject('10000000-0000-4000-8000-000000000002')
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: sourceId,
      subjects: [subject(), second]
    })
    await t.run(async (ctx) => {
      const roots = await ctx.db.query('authoredRoots').take(10)
      await ctx.db.patch(roots[0]._id, {
        currentVersionId: roots[1].currentVersionId
      })
    })
    await expect(t.query(internal.content.import.readSubjects, page)).rejects.toThrow(
      'version pointer'
    )
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: [subject()]
      })
    ).rejects.toThrow('Canonical content conflict')
  })

  it('detects document corruption and fingerprints metadata-only changes', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: sourceId,
      subjects: [subject()]
    })
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: sourceId,
      definitions: [definition]
    })
    await t.run(async (ctx) => {
      const version = (await ctx.db.query('authoredVersions').take(1))[0]
      const chunk = await ctx.db
        .query('authoredVersionPayloadChunks')
        .withIndex('by_versionId_chunkIndex', (query) => query.eq('versionId', version.versionId))
        .first()
      if (!chunk) throw new Error('Missing stored version chunk')
      const corrupted = chunk.bytes.slice(0)
      const corruptedBytes = new Uint8Array(corrupted)
      corruptedBytes[0] = (corruptedBytes[0] ?? 0) ^ 1
      await ctx.db.patch(chunk._id, { bytes: corrupted })
      const storedDefinition = (await ctx.db.query('reusableDefinitions').take(1))[0]
      await ctx.db.patch(storedDefinition._id, {
        label: 'Changed metadata only'
      })
    })
    await expect(t.query(internal.content.import.readSubjects, page)).rejects.toThrow()
    const result = await t.query(internal.content.import.readDefinitions, page)
    expect(result.page[0].checksum).not.toBe(checksumRuleDocument(definition))
    expect(result.page[0].checksum).toBe(
      checksumRuleDocument({ ...definition, label: 'Changed metadata only' })
    )
  })

  it('bounds import batches and read pages', async () => {
    const t = convexTest(schema, modules)
    await t.mutation(internal.content.import.bootstrap, bootstrap)
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: sourceId,
        subjects: Array.from({ length: 11 }, () => subject())
      })
    ).rejects.toThrow()
    for (const numItems of [0, 11]) {
      await expect(
        t.query(internal.content.import.readSubjects, {
          ...page,
          paginationOpts: { cursor: null, numItems }
        })
      ).rejects.toThrow('page size')
    }
  })
})
