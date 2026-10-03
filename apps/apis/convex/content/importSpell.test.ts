import { convexTest } from '../../tests/convexTest'
import { expect, it } from 'vitest'
import type { SourceImportAuditPageDto } from '@artificer-toolkit/schema/api/sourceImport'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { prismaticWall } from '@artificer-toolkit/source-data/srd/spells/prismatic-wall.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  importedSubject,
  setVersionCompilation,
  versionWithCompilation
} from '../../tests/fixtures/publication'
import { internal } from '../_generated/api'
import schema from '../schema'
import { sourceImportBatches } from './importBatches'
import { compilePublicationDocument, parsePublicationDocument } from './publicationDocument'
import { readStoredAuthoredVersionDocument } from './documents'

it('compiles every canonical Spell, audits it, and backfills only exact missing compilation atomically', async () => {
  const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  await t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: srdSystemRecord.id,
        document: jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord))),
        checksum: checksumRuleDocument(srdSystemRecord)
      }
    ],
    contentSource: SRD_CONTENT_SOURCE,
    catalogue: SRD_RULES_CATALOGUE
  })
  const subjects = srdBaselineContent.subjects.spells.map((document) =>
    importedSubject({ subjectKind: 'SPELL', ...document, document })
  )
  for (const batch of sourceImportBatches(subjects)) {
    expect(
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: batch
      })
    ).toEqual({ inserted: batch.length, reused: 0 })
  }
  for (const subject of subjects) {
    const stored = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', subject.id))
        .unique()
      if (!root) throw new Error('Missing canonical Spell')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      if (!version) throw new Error('Missing canonical Spell version')
      return {
        root,
        version,
        document: await readStoredAuthoredVersionDocument(ctx, version)
      }
    })
    expect(stored.version.compilation).toEqual(
      compilePublicationDocument(parsePublicationDocument('SPELL', subject.document))
    )
    expect(stored.document).toEqual(subject.document)
    expect(stored.root.checksum).toBe(subject.checksum)
  }
  const audit = async () => {
    let cursor: string | null = null
    let audited = 0
    do {
      const page: SourceImportAuditPageDto = await t.query(internal.content.import.readSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        paginationOpts: { numItems: 5, cursor }
      })
      audited += page.page.length
      cursor = page.isDone ? null : page.continueCursor
    } while (cursor !== null)
    return audited
  }
  expect(await audit()).toBe(subjects.length)

  const selected = [fireball.id, prismaticWall.id].map((id) => {
    const subject = subjects.find((subject) => subject.id === id)
    if (!subject) throw new Error('Missing canonical Spell fixture')
    return subject
  })
  const before = await t.run(async (ctx) =>
    Promise.all(
      selected.map(async ({ id }) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
        if (!root) throw new Error('Missing canonical Spell')
        const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
        if (!version?.compilation) throw new Error('Missing canonical Spell compilation')
        return { root, version, compilation: version.compilation }
      })
    )
  )
  const [first, second] = before
  if (!first || !second) throw new Error('Missing replay fixtures')
  const input = { contentSourceId: SRD_CONTENT_SOURCE.id, subjects: selected }
  expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
    inserted: 0,
    reused: 2
  })
  await t.run(async (ctx) => {
    await setVersionCompilation(ctx, first.version, undefined)
    await setVersionCompilation(ctx, second.version, {
      ...second.compilation,
      projectionJson: '{}'
    })
  })
  await expect(t.mutation(internal.content.import.importSubjects, input)).rejects.toThrow(
    'Canonical content conflict'
  )
  await expect(audit()).rejects.toThrow()
  expect(
    await t.run(async (ctx) => versionWithCompilation(ctx, await ctx.db.get(first.version._id)))
  ).toEqual({ ...first.version, compilation: undefined })
  await t.run((ctx) => setVersionCompilation(ctx, second.version, second.compilation))
  expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
    inserted: 0,
    reused: 2
  })
  for (const stored of before) {
    expect(await t.run((ctx) => ctx.db.get(stored.root._id))).toEqual(stored.root)
    expect(
      await t.run(async (ctx) => versionWithCompilation(ctx, await ctx.db.get(stored.version._id)))
    ).toEqual(stored.version)
  }
}, 120_000)
