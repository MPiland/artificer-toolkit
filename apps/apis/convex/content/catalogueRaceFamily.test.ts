import { describe, expect, it } from 'vitest'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { hillDwarf } from '@artificer-toolkit/source-data/srd/races/dwarf.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { authoredPublishDraftInputSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import type {
  AuthoredCataloguePage,
  AuthoredCatalogueReadInput,
  AuthoredCatalogueSearchBackfillResult
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { api, internal } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'

const ids = Array.from(
  { length: 5 },
  (_, index) => `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
)
const subjects = [
  { ...human, id: ids[0]!, label: 'Shared', selectionMode: 'REQUIRES_SUBRACE' },
  { ...human, id: ids[1]!, label: 'Shared' },
  { ...human, id: ids[2]!, label: 'Alpha' },
  { ...hillDwarf, id: ids[3]!, label: 'Zulu', parentRaceId: ids[0]! },
  { ...hillDwarf, id: ids[4]!, label: 'Alpha', parentRaceId: ids[1]! }
].map((document) => importedSubject({ subjectKind: 'RACE', ...document, document }))
const input = {
  subjectKind: 'RACE',
  sort: 'family',
  paginationOpts: { cursor: null, numItems: 48 }
} satisfies AuthoredCatalogueReadInput

async function fixture() {
  const result = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [subjects.slice(0, 3), subjects.slice(3)]
  )
  for (const subject of subjects)
    await result.t.mutation(internal.content.raceRelationships.syncDerived, {
      id: subject.id,
      checksum: subject.checksum
    })
  return result
}

describe('native Race catalogue families', () => {
  it('preserves playable facts and merges master/owned children under UUID parents through replayable pages', async () => {
    const { t, first, second } = await fixture()
    const copy = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: ids[3]!
    })
    const saved = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: copy.subjectId,
      systemId: copy.systemId,
      label: 'Delta',
      payload: copy.payload
    })
    await first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'RACE',
      subjectId: saved.subjectId,
      expectedDraftUpdatedAt: authoredPublishDraftInputSchema.shape.expectedDraftUpdatedAt.parse(
        saved.updatedAt
      )
    })
    for (const systemId of [undefined, human.systemId]) {
      const visited: string[] = []
      let cursor: string | null = null
      let done = false
      for (let index = 0; index < 8 && !done; index++) {
        const request: AuthoredCatalogueReadInput = {
          ...input,
          systemId,
          paginationOpts: { cursor, numItems: 1 }
        }
        const page: AuthoredCataloguePage = await first.caller.query(
          api.content.catalogue.list,
          request
        )
        expect(await first.caller.query(api.content.catalogue.list, request)).toEqual(page)
        expect(
          (
            await first.caller.query(api.content.catalogue.list, {
              ...request,
              paginationOpts: { ...request.paginationOpts, endCursor: page.continueCursor }
            })
          ).page
        ).toEqual(page.page)
        visited.push(...page.page.map((row) => row.id))
        cursor = page.continueCursor
        done = page.isDone
      }
      expect(done).toBe(true)
      expect(visited).toEqual([ids[2], ids[0], saved.subjectId, ids[3], ids[1], ids[4]])
      const filtered = await first.caller.query(api.content.catalogue.list, {
        ...input,
        systemId,
        category: 'SUBRACE'
      })
      expect(filtered.page).toMatchObject([
        { id: saved.subjectId, parentRaceId: ids[0], parentRaceLabel: 'Shared' },
        { id: ids[3], parentRaceId: ids[0], parentRaceLabel: 'Shared' },
        { id: ids[4], parentRaceId: ids[1], parentRaceLabel: 'Shared' }
      ])
      const base = await first.caller.query(api.content.catalogue.list, {
        ...input,
        systemId,
        category: 'BASE'
      })
      expect(base.page).toMatchObject([
        { id: ids[2], selectionMode: 'DIRECT' },
        { id: ids[0], selectionMode: 'REQUIRES_SUBRACE' },
        { id: ids[1], selectionMode: 'DIRECT' }
      ])
      expect(
        (await second.caller.query(api.content.catalogue.list, { ...input, systemId })).page.map(
          (row) => row.id
        )
      ).not.toContain(saved.subjectId)
      expect(
        (await t.query(api.content.catalogue.list, { ...input, systemId })).page.map(
          (row) => row.id
        )
      ).not.toContain(saved.subjectId)
    }
    expect(
      (
        await first.caller.query(api.content.catalogue.search, {
          subjectKind: 'RACE',
          source: 'OWNED',
          query: 'Delta',
          paginationOpts: input.paginationOpts
        })
      ).page
    ).toMatchObject([{ id: saved.subjectId, parentRaceId: ids[0], parentRaceLabel: 'Shared' }])
  })

  it('backfills only missing family/playable metadata and keeps canonical replay exact', async () => {
    const { t } = await fixture()
    const before = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', ids[0]!))
        .unique()
      if (!root?.catalogue) throw new Error('Missing base Race fixture')
      return { root, version: await ctx.db.get(root.currentVersionId) }
    })
    await t.run((ctx) =>
      ctx.db.patch(before.root._id, {
        catalogueFamily: undefined,
        catalogue: { ...before.root.catalogue!, selectionMode: undefined }
      })
    )
    await expect(t.query(api.content.catalogue.list, input)).rejects.toThrow(
      'family backfill is incomplete'
    )
    for (const systemId of [undefined, human.systemId])
      expect(
        (await t.query(api.content.catalogue.list, { ...input, systemId, category: 'SUBRACE' }))
          .page
      ).toHaveLength(2)
    let cursor: string | null = null
    let done = false
    for (let index = 0; index < 8 && !done; index++) {
      const page: AuthoredCatalogueSearchBackfillResult = await t.mutation(
        internal.content.catalogueSearchBackfill.backfill,
        {
          paginationOpts: { cursor, numItems: 2 }
        }
      )
      cursor = page.continueCursor
      done = page.isDone
    }
    expect(done).toBe(true)
    expect(await t.run((ctx) => ctx.db.get(before.root._id))).toEqual(before.root)
    expect(await t.run((ctx) => ctx.db.get(before.root.currentVersionId))).toEqual(before.version)
    expect(
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects
      })
    ).toEqual({ inserted: 0, reused: 5 })
    await t.run((ctx) =>
      ctx.db.patch(before.root._id, {
        catalogue: { ...before.root.catalogue!, selectionMode: 'DIRECT' }
      })
    )
    await expect(
      t.mutation(internal.content.catalogueSearchBackfill.backfill, {
        paginationOpts: { cursor: null, numItems: 2 }
      })
    ).rejects.toThrow('metadata mismatch')
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects
      })
    ).rejects.toThrow('Canonical content conflict')
  })
})
