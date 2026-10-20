'use node'

import * as zMini from 'zod/mini'

import { brotliDecompressSync } from 'node:zlib'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  sourceImportCatalogueDtoSchema,
  sourceImportContentSourceDtoSchema,
  sourceImportAuditDtoSchema,
  sourceImportDefinitionDtoSchema,
  sourceImportSeedResultDtoSchema,
  sourceImportSubjectDtoSchema,
  sourceImportSystemDtoSchema,
  type SourceImportAuditDto,
  type SourceImportAuditPageDto,
  type SourceImportBootstrapInput,
  type SourceImportDefinitionsInput,
  type SourceImportSeedResultDto,
  type SourceImportSubjectsInput
} from '@artificer-toolkit/schema/api/sourceImport'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { compilePublicationDocument, parsePublicationDocument } from './publicationDocument'
import { srdManifestBrotliBase64 } from './srdManifest.generated'
import { internal } from '../_generated/api'
import { internalAction, type ActionCtx } from '../_generated/server'
import { sourceImportBatches } from './importBatches'

type SrdImportManifest = {
  systems: SourceImportBootstrapInput['systems']
  subjects: SourceImportSubjectsInput['subjects']
  definitions: SourceImportDefinitionsInput['definitions']
  catalogue: SourceImportBootstrapInput['catalogue']
  contentSource: SourceImportBootstrapInput['contentSource']
  manifestChecksum: string
}

let cachedManifest: { encoded: string; manifest: SrdImportManifest } | undefined

function prepared(): SrdImportManifest {
  const encoded = srdManifestBrotliBase64
  if (cachedManifest?.encoded === encoded) return cachedManifest.manifest
  const parsed = JSON.parse(
    brotliDecompressSync(Buffer.from(encoded, 'base64')).toString('utf8')
  ) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Generated SRD manifest is invalid.')
  const manifest = parsed as Record<string, unknown>
  const result = {
    systems: zMini
      .array(sourceImportSystemDtoSchema)
      .check(zMini.length(1))
      .parse(manifest.systems),
    subjects: zMini.array(sourceImportSubjectDtoSchema).parse(manifest.subjects),
    definitions: zMini.array(sourceImportDefinitionDtoSchema).parse(manifest.definitions),
    catalogue: sourceImportCatalogueDtoSchema.parse(manifest.catalogue),
    contentSource: sourceImportContentSourceDtoSchema.parse(manifest.contentSource),
    manifestChecksum: zMini
      .pick(sourceImportAuditDtoSchema, { manifestChecksum: true })
      .parse({ manifestChecksum: manifest.manifestChecksum }).manifestChecksum
  }
  const checksum = checksumRuleDocument(
    jsonValueSchema.parse({
      systems: result.systems,
      subjects: result.subjects,
      definitions: result.definitions,
      catalogue: result.catalogue,
      contentSource: result.contentSource
    })
  )
  if (checksum !== result.manifestChecksum)
    throw new Error('Generated SRD manifest checksum differs.')
  cachedManifest = { encoded, manifest: result }
  return result
}

function exact(actual: unknown, expected: unknown) {
  if (
    checksumRuleDocument(jsonValueSchema.parse(actual)) !==
    checksumRuleDocument(jsonValueSchema.parse(expected))
  )
    throw new Error('Stored SRD differs from canonical source.')
}

function recordIdentity(record: { id: string }) {
  return { id: record.id, checksum: checksumRuleDocument(jsonValueSchema.parse(record)) }
}

function classDerived(subject: SrdImportManifest['subjects'][number]) {
  if (subject.subjectKind !== 'CLASS') throw new Error('Expected canonical Class.')
  const parsed = parsePublicationDocument('CLASS', subject.document)
  return {
    id: subject.id,
    checksum: subject.checksum,
    parentClassId: parsed.document.category === 'SUBCLASS' ? parsed.document.parentClassId : null,
    compilation: compilePublicationDocument(parsed)
  }
}

async function auditPrepared(
  ctx: ActionCtx,
  manifest: SrdImportManifest
): Promise<SourceImportAuditDto> {
  const bootstrap = await ctx.runQuery(internal.content.import.readBootstrap, {
    systemIds: manifest.systems.map((system) => system.id),
    contentSourceId: manifest.contentSource.id,
    catalogueId: manifest.catalogue.id
  })
  exact(bootstrap, {
    systems: manifest.systems.map(recordIdentity),
    contentSource: manifest.contentSource,
    catalogue: manifest.catalogue
  })
  const expectedSubjects = new Map(manifest.subjects.map((subject) => [subject.id, subject]))
  let remainingClasses = manifest.subjects.filter(
    (subject) => subject.subjectKind === 'CLASS'
  ).length
  const expectedDefinitions = new Map(
    manifest.definitions.map((definition) => [
      definition.id,
      sourceImportDefinitionDtoSchema.parse(definition)
    ])
  )
  let cursor: string | null = null
  let subjectCount = 0
  do {
    const page: SourceImportAuditPageDto = await ctx.runQuery(
      internal.content.import.readSubjects,
      {
        contentSourceId: manifest.contentSource.id,
        // Full Class payloads require one-item queries; five gives other roots CPU headroom.
        paginationOpts: { numItems: remainingClasses ? 1 : 5, cursor }
      }
    )
    for (const subject of page.page) {
      const expected = expectedSubjects.get(subject.id)
      if (!expected) throw new Error('Unexpected or duplicate canonical subject.')
      if (expected.subjectKind === 'CLASS') remainingClasses--
      exact(subject, recordIdentity(expected))
      expectedSubjects.delete(subject.id)
      subjectCount++
    }
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor !== null)
  let definitionCount = 0
  do {
    const page: SourceImportAuditPageDto = await ctx.runQuery(
      internal.content.import.readDefinitions,
      {
        contentSourceId: manifest.contentSource.id,
        paginationOpts: { numItems: 10, cursor }
      }
    )
    for (const definition of page.page) {
      const expected = expectedDefinitions.get(definition.id)
      if (!expected) throw new Error('Unexpected or duplicate canonical definition.')
      exact(definition, recordIdentity(expected))
      expectedDefinitions.delete(definition.id)
      definitionCount++
    }
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor !== null)
  if (expectedSubjects.size || expectedDefinitions.size)
    throw new Error('Canonical SRD import is incomplete.')
  for (const subject of manifest.subjects) {
    if (subject.subjectKind !== 'CLASS') continue
    const derived = classDerived(subject)
    exact(
      await ctx.runQuery(internal.content.import.readClassDerived, {
        id: subject.id,
        checksum: subject.checksum
      }),
      { parentClassId: derived.parentClassId, compilation: derived.compilation }
    )
  }
  const expectedCounts = new Map<string, number>()
  for (const subject of manifest.subjects) {
    expectedCounts.set(subject.subjectKind, (expectedCounts.get(subject.subjectKind) ?? 0) + 1)
  }
  const catalogueCounts = await ctx.runQuery(internal.content.import.readCatalogueCounts, {
    contentSourceId: manifest.contentSource.id
  })
  exact(
    catalogueCounts.map(({ subjectKind, count }) => [subjectKind, count]).sort(),
    [...expectedCounts.entries()].sort()
  )
  return {
    systems: bootstrap.systems.length,
    subjects: subjectCount,
    definitions: definitionCount,
    manifestChecksum: manifest.manifestChecksum
  }
}

// Removal is not supported: the seed refuses a stored record missing from the corpus before it
// writes any subject or definition, rather than leave it stale.
async function storedChecksums(
  readPage: (cursor: string | null) => Promise<SourceImportAuditPageDto>
) {
  const stored = new Map<string, string>()
  let cursor: string | null = null
  do {
    const page: SourceImportAuditPageDto = await readPage(cursor)
    for (const { id, checksum } of page.page) stored.set(id, checksum)
    cursor = page.isDone ? null : page.continueCursor
  } while (cursor !== null)
  return stored
}

function requireNoneRemoved(
  kind: string,
  stored: ReadonlyMap<string, string>,
  expected: ReadonlyMap<string, unknown>
) {
  const removed = [...stored.keys()].filter((id) => !expected.has(id))
  if (removed.length)
    throw new Error(
      `Canonical ${kind} were removed from the corpus, which the seed cannot apply: ${removed.join(', ')}.`
    )
}

// Returns the ids whose stored checksum differs, which the import replaces in place.
async function changedSubjectIds(ctx: ActionCtx, manifest: SrdImportManifest) {
  const expected = new Map(manifest.subjects.map((subject) => [subject.id, subject.checksum]))
  const stored = await storedChecksums((cursor) =>
    ctx.runQuery(internal.content.import.readSubjectChecksums, {
      contentSourceId: manifest.contentSource.id,
      paginationOpts: { numItems: 10, cursor }
    })
  )
  requireNoneRemoved('subjects', stored, expected)
  return new Set(
    [...stored].filter(([id, checksum]) => expected.get(id) !== checksum).map(([id]) => id)
  )
}

// CLI-only internal action. Batches commit independently; exact repeats make interrupted
// provisioning resumable. A changed System, source, catalogue, subject or definition is replaced in place
// (ADR 0024, D120); a subject or definition missing from the corpus fails the seed before it writes them.
export const seed = internalAction({
  args: {},
  returns: zodToConvex(sourceImportSeedResultDtoSchema),
  handler: async (ctx): Promise<SourceImportSeedResultDto> => {
    const manifest = prepared()
    const counts = await ctx.runMutation(internal.content.import.bootstrap, {
      systems: manifest.systems,
      contentSource: manifest.contentSource,
      catalogue: manifest.catalogue
    })
    const changed = await changedSubjectIds(ctx, manifest)
    requireNoneRemoved(
      'definitions',
      await storedChecksums((cursor) =>
        ctx.runQuery(internal.content.import.readDefinitionChecksums, {
          contentSourceId: manifest.contentSource.id,
          paginationOpts: { numItems: 10, cursor }
        })
      ),
      new Map(manifest.definitions.map((definition) => [definition.id, definition]))
    )
    // A replaced parent leaves the dependents a later batch replaces to that batch, whose import
    // compiles them against the current parent: their stored documents may predate its schema.
    const reimported = new Set(changed)
    for (const subjects of sourceImportBatches(manifest.subjects, ({ id }) => changed.has(id))) {
      for (const { id } of subjects) reimported.delete(id)
      const batch = await ctx.runMutation(internal.content.import.importSubjects, {
        contentSourceId: manifest.contentSource.id,
        subjects,
        reimportedSubjectIds: [...reimported]
      })
      counts.inserted += batch.inserted
      counts.reused += batch.reused
      counts.replaced += batch.replaced
    }
    for (const subject of manifest.subjects) {
      if (subject.subjectKind === 'CLASS')
        await ctx.runMutation(internal.content.import.syncClassDerived, classDerived(subject))
    }
    for (const category of ['BASE', 'SUBRACE']) {
      for (const subject of manifest.subjects) {
        if (
          subject.subjectKind === 'RACE' &&
          raceAuthoredDtoSchema.parse(subject.document).category === category
        )
          await ctx.runMutation(internal.content.raceRelationships.syncDerived, {
            id: subject.id,
            checksum: subject.checksum
          })
      }
    }
    // Derived writes invalidate the same snapshot head; serialize them to avoid OCC retries.
    for (const subject of manifest.subjects) {
      if (subject.subjectKind === 'EQUIPMENT')
        await ctx.runMutation(internal.content.import.syncEquipmentDerived, {
          id: subject.id,
          checksum: subject.checksum
        })
    }
    for (const definitions of sourceImportBatches(manifest.definitions)) {
      const batch = await ctx.runMutation(internal.content.import.importDefinitions, {
        contentSourceId: manifest.contentSource.id,
        definitions: definitions.map((definition) =>
          sourceImportDefinitionDtoSchema.parse(definition)
        )
      })
      counts.inserted += batch.inserted
      counts.reused += batch.reused
      counts.replaced += batch.replaced
    }
    return { ...(await auditPrepared(ctx, manifest)), ...counts }
  }
})

export const audit = internalAction({
  args: {},
  returns: zodToConvex(sourceImportAuditDtoSchema),
  handler: async (ctx): Promise<SourceImportAuditDto> => await auditPrepared(ctx, prepared())
})
