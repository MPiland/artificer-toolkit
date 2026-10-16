import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import type { SourceImportAuditPageDto } from '@artificer-toolkit/schema/api/sourceImport'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
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

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')

describe.each([
  ['CREATURE', srdBaselineContent.subjects.creatures],
  ['VEHICLE', srdBaselineContent.subjects.vehicles]
] as const)('canonical %s import', (subjectKind, documents) => {
  it('compiles, audits, and atomically backfills only exact compilations', async () => {
    const t = convexTest(schema, modules)
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
    const subjects = documents.map((document) =>
      importedSubject({ subjectKind, ...document, document })
    )
    for (const batch of sourceImportBatches(subjects))
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: batch
      })

    for (const subject of subjects) {
      const stored = await t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', subject.id))
          .unique()
        if (!root) throw new Error(`Missing canonical ${subjectKind}`)
        const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
        if (!version?.compilation) throw new Error(`Missing ${subjectKind} compilation`)
        return {
          root,
          version,
          document: await readStoredAuthoredVersionDocument(ctx, version)
        }
      })
      expect(stored.version.compilation).toEqual(
        compilePublicationDocument(parsePublicationDocument(subjectKind, subject.document))
      )
      expect(stored.document).toEqual(subject.document)
      expect({ id: stored.root.id, checksum: stored.root.checksum }).toEqual({
        id: subject.id,
        checksum: subject.checksum
      })
      expect({
        id: stored.version.id,
        version: stored.version.version
      }).toEqual({
        id: subject.id,
        version: 1
      })
    }

    const audit = async () => {
      let cursor: string | null = null
      let audited = 0
      do {
        const page: SourceImportAuditPageDto = await t.query(internal.content.import.readSubjects, {
          contentSourceId: SRD_CONTENT_SOURCE.id,
          paginationOpts: { numItems: 10, cursor }
        })
        audited += page.page.length
        cursor = page.isDone ? null : page.continueCursor
      } while (cursor !== null)
      return audited
    }
    expect(await audit()).toBe(subjects.length)

    const selected = subjects.slice(0, 2)
    const before = await t.run(async (ctx) =>
      Promise.all(
        selected.map(async ({ id }) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
          if (!root) throw new Error(`Missing ${subjectKind} replay fixture`)
          const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
          if (!version?.compilation) throw new Error(`Missing ${subjectKind} replay compilation`)
          return { root, version, compilation: version.compilation }
        })
      )
    )
    const [first, second] = before
    if (!first || !second) throw new Error(`Missing ${subjectKind} replay fixtures`)
    const input = {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: selected
    }
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
    expect(
      await t.run(async (ctx) => versionWithCompilation(ctx, await ctx.db.get(first.version._id)))
    ).toEqual({ ...first.version, compilation: undefined })
    await expect(audit()).rejects.toThrow()

    await t.run((ctx) => setVersionCompilation(ctx, second.version, second.compilation))
    expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
      inserted: 0,
      reused: 2,
      replaced: 0
    })
    expect(
      await t.run(async (ctx) => versionWithCompilation(ctx, await ctx.db.get(first.version._id)))
    ).toEqual(first.version)
    expect(
      await t.run(async (ctx) => versionWithCompilation(ctx, await ctx.db.get(second.version._id)))
    ).toEqual(second.version)
    for (const stored of before) {
      expect(await t.run((ctx) => ctx.db.get(stored.root._id))).toEqual(stored.root)
    }
  }, 120_000)
})
