import { describe, expect, it } from 'vitest'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  authoredCatalogueSearchInputSchema,
  type AuthoredCatalogueReadInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api, internal } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'

const otherSystemId = '10000000-0000-4000-8000-000000000102'
const otherSourceId = '20000000-0000-4000-8000-000000000102'
const otherId = '40000000-0000-4000-8000-000000000102'
const input = {
  subjectKind: 'EQUIPMENT',
  sort: 'category',
  paginationOpts: { cursor: null, numItems: 48 }
} satisfies AuthoredCatalogueReadInput

async function fixture() {
  const result = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [club, { ...backpack, label: 'Zebra pack' }].map((document) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
      )
    ]
  )
  const system = { ...srdSystemRecord, id: otherSystemId }
  await result.t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: otherSystemId,
        document: jsonValueSchema.parse(JSON.parse(JSON.stringify(system))),
        checksum: checksumRuleDocument(system)
      }
    ],
    contentSource: { ...SRD_CONTENT_SOURCE, id: otherSourceId, gameSystemId: otherSystemId },
    catalogue: {
      ...SRD_RULES_CATALOGUE,
      id: '30000000-0000-4000-8000-000000000102',
      gameSystemId: otherSystemId
    }
  })
  const document = { ...backpack, id: otherId, systemId: otherSystemId, label: 'Zebra pack' }
  await result.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: otherSourceId,
    subjects: [importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })]
  })
  return result
}

describe('native category browse', () => {
  it('orders by category/name/UUID across Systems with bounded replay and fixed range ends', async () => {
    const { t } = await fixture()
    const expected = [...[backpack.id, otherId].sort(), club.id]
    const all = await t.query(api.content.catalogue.list, input)
    expect(all.page.map((row) => row.id)).toEqual(expected)
    expect(
      (await t.query(api.content.catalogue.list, { ...input, sort: 'name' })).page[0]?.id
    ).toBe(club.id)
    const ids: string[] = []
    let cursor: string | null = null
    let done = false
    for (let index = 0; index < 6 && !done; index++) {
      const request: AuthoredCatalogueReadInput = {
        ...input,
        paginationOpts: { cursor, numItems: 1 }
      }
      const page = await t.query(api.content.catalogue.list, request)
      expect(await t.query(api.content.catalogue.list, request)).toEqual(page)
      expect(page.page.length).toBeLessThanOrEqual(1)
      expect(
        (
          await t.query(api.content.catalogue.list, {
            ...request,
            paginationOpts: { ...request.paginationOpts, endCursor: page.continueCursor }
          })
        ).page
      ).toEqual(page.page)
      ids.push(...page.page.map((row) => row.id))
      cursor = page.continueCursor
      done = page.isDone
    }
    expect(done).toBe(true)
    expect(ids).toEqual(expected)
    for (const sort of ['name', 'category'] as const) {
      expect(
        (
          await t.query(api.content.catalogue.list, {
            ...input,
            sort,
            category: 'ADVENTURING_GEAR'
          })
        ).page.map((row) => row.id)
      ).toEqual(expected.slice(0, 2))
      expect(
        (
          await t.query(api.content.catalogue.list, {
            ...input,
            sort,
            category: 'ADVENTURING_GEAR',
            systemId: otherSystemId
          })
        ).page.map((row) => row.id)
      ).toEqual([otherId])
    }
    expect(
      (await t.query(api.content.catalogue.list, { ...input, systemId: club.systemId })).page.map(
        (row) => row.id
      )
    ).toEqual([backpack.id, club.id])
    expect(
      (await t.query(api.content.catalogue.list, { ...input, category: 'ARMOR' })).page
    ).toEqual([])
  })

  it('scopes category rows and totals to the current owner before exposing rows or cursors', async () => {
    const { t, first, second } = await fixture()
    const ownedIds: string[] = []
    for (const actor of [first, second]) {
      const draft = await actor.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: 'EQUIPMENT',
        subjectId: backpack.id
      })
      if (!draft.updatedAt) throw new Error('Missing draft revision')
      await actor.caller.mutation(api.content.publication.publishDraft, {
        subjectKind: 'EQUIPMENT',
        subjectId: draft.subjectId,
        expectedDraftUpdatedAt: draft.updatedAt
      })
      ownedIds.push(draft.subjectId)
    }
    const request = { ...input, category: 'ADVENTURING_GEAR' }
    const visible = await first.caller.query(api.content.catalogue.list, request)
    expect(visible.page.map((row) => row.id).sort()).toEqual(
      [backpack.id, otherId, ownedIds[0]!].sort()
    )
    expect(JSON.stringify(visible)).not.toContain(ownedIds[1])
    expect(
      (
        await first.caller.query(api.content.catalogue.list, { ...request, source: 'OWNED' })
      ).page.map((row) => row.id)
    ).toEqual([ownedIds[0]])
    expect(
      (await t.query(api.content.catalogue.list, { ...request, source: 'OWNED' })).page
    ).toEqual([])
    expect(
      await first.caller.query(api.content.catalogue.summary, {
        subjectKind: 'EQUIPMENT',
        category: 'ADVENTURING_GEAR'
      })
    ).toEqual({
      activeCount: 4,
      masterCount: 3,
      ownedCount: 1,
      totalCount: 3,
      categories: ['ADVENTURING_GEAR', 'WEAPON']
    })
    expect(
      (
        await first.caller.query(api.content.catalogue.summary, {
          subjectKind: 'EQUIPMENT',
          source: 'OWNED',
          category: 'WEAPON'
        })
      ).totalCount
    ).toBe(0)
    for (const subjectKind of ['BACKGROUND', 'FEAT', 'SPELL'] as const) {
      await expect(t.query(api.content.catalogue.list, { ...input, subjectKind })).rejects.toThrow(
        'category filtering is not supported'
      )
      await expect(
        t.query(api.content.catalogue.summary, { subjectKind, category: 'unsupported' })
      ).rejects.toThrow('category filtering is not supported')
      await expect(
        t.query(api.content.catalogue.search, {
          subjectKind,
          category: 'unsupported',
          source: 'MASTER',
          query: 'example',
          paginationOpts: input.paginationOpts
        })
      ).rejects.toThrow('category filtering is not supported')
    }
    expect(
      authoredCatalogueSearchInputSchema.safeParse({ ...input, source: 'MASTER', query: 'club' })
        .success
    ).toBe(false)
  })
})
