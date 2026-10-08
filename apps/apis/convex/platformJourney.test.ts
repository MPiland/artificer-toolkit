import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  SystemListPageDto,
  SystemListPageInputDto,
  SystemLookupInputDto,
  SystemResponseDto
} from '@artificer-toolkit/schema/api/systems'
import type {
  SourceImportAuditPageDto,
  SourceImportBootstrapInput
} from '@artificer-toolkit/schema/api/sourceImport'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { convexTest } from '../tests/convexTest'
import { importedSubject } from '../tests/fixtures/publication'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const get = makeFunctionReference<'query', SystemLookupInputDto, SystemResponseDto>(
  'content/systems:get'
)
const list = makeFunctionReference<'query', SystemListPageInputDto, SystemListPageDto>(
  'content/systems:list'
)

function systemEntry(id: string) {
  const document = jsonValueSchema.parse({ ...srdSystemRecord, id })
  return { id, document, checksum: checksumRuleDocument(document) }
}

const srdBootstrap: SourceImportBootstrapInput = {
  systems: [systemEntry(srdSystemRecord.id)],
  contentSource: SRD_CONTENT_SOURCE,
  catalogue: SRD_RULES_CATALOGUE
}

const secondSystemId = 'a0000000-0000-4000-8000-000000000001'
const secondBootstrap: SourceImportBootstrapInput = {
  systems: [systemEntry(secondSystemId)],
  contentSource: {
    ...SRD_CONTENT_SOURCE,
    id: 'a0000000-0000-4000-8000-000000000002',
    gameSystemId: secondSystemId
  },
  catalogue: {
    ...SRD_RULES_CATALOGUE,
    id: 'a0000000-0000-4000-8000-000000000003',
    gameSystemId: secondSystemId
  }
}

const srdSubjects = [
  importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte }),
  importedSubject({ subjectKind: 'FEAT', ...grappler, document: grappler }),
  importedSubject({ subjectKind: 'SPELL', ...fireball, document: fireball })
]

const journeyTables = {
  systems: [{ indexDescriptor: 'by_publicId', fields: ['id'] }],
  contentSources: [
    { indexDescriptor: 'by_publicId', fields: ['id'] },
    {
      indexDescriptor: 'by_gameSystemId_kind_ownerUserId',
      fields: ['gameSystemId', 'kind', 'ownerUserId']
    }
  ],
  rulesCatalogues: [
    { indexDescriptor: 'by_publicId', fields: ['id'] },
    { indexDescriptor: 'by_gameSystemId', fields: ['gameSystemId'] }
  ],
  authoredRoots: [
    { indexDescriptor: 'by_publicId', fields: ['id'] },
    { indexDescriptor: 'by_contentSourceId', fields: ['contentSourceId'] },
    {
      indexDescriptor: 'by_contentSourceId_subjectKind_ownerUserId',
      fields: ['contentSourceId', 'subjectKind', 'ownerUserId']
    },
    {
      indexDescriptor: 'by_system_kind_owner_name_id',
      fields: ['systemId', 'subjectKind', 'ownerUserId', 'catalogue.nameKey', 'id']
    }
  ],
  authoredCatalogueCounts: [
    { indexDescriptor: 'by_source_kind', fields: ['contentSourceId', 'subjectKind'] }
  ]
} as const

describe('Platform bootstrap and bounded read journeys (PLATFORM-2)', () => {
  it('admits one paired System per platform source and serves bounded, scoped, leak-free reads', async () => {
    const t = convexTest(schema, modules)
    const rowCounts = () =>
      t.run(async (ctx) => ({
        systems: (await ctx.db.query('systems').take(10)).length,
        contentSources: (await ctx.db.query('contentSources').take(10)).length,
        rulesCatalogues: (await ctx.db.query('rulesCatalogues').take(10)).length
      }))
    const empty = { systems: 0, contentSources: 0, rulesCatalogues: 0 }

    // 1. An empty deployment lists nothing and refuses a malformed id.
    expect(await t.query(list, { cursor: null, limit: 10 })).toMatchObject({
      page: [],
      isDone: true
    })
    expect(await t.query(get, { id: srdSystemRecord.id })).toBeNull()
    await expect(t.query(get, { id: 'not-a-uuid' })).rejects.toThrow()

    // 2. A bootstrap carrying two Systems for one platform source is refused and leaves nothing.
    await expect(
      t.mutation(internal.content.import.bootstrap, {
        ...srdBootstrap,
        systems: [...srdBootstrap.systems, systemEntry(secondSystemId)]
      })
    ).rejects.toThrow()
    expect(await rowCounts()).toEqual(empty)
    expect((await t.query(list, { cursor: null, limit: 10 })).page).toEqual([])

    // 3. The paired SRD bootstrap admits exactly one System and replays idempotently.
    expect(await t.mutation(internal.content.import.bootstrap, srdBootstrap)).toEqual({
      inserted: 3,
      reused: 0
    })
    const admitted = { systems: 1, contentSources: 1, rulesCatalogues: 1 }
    expect(await rowCounts()).toEqual(admitted)
    expect(await t.mutation(internal.content.import.bootstrap, srdBootstrap)).toEqual({
      inserted: 0,
      reused: 3
    })
    expect(await rowCounts()).toEqual(admitted)

    // 4. A second System arrives through its own paired import and pages in exactly once.
    await t.mutation(internal.content.import.bootstrap, secondBootstrap)
    expect(await rowCounts()).toEqual({ systems: 2, contentSources: 2, rulesCatalogues: 2 })
    const first = await t.query(list, { cursor: null, limit: 1 })
    const second = await t.query(list, { cursor: first.continueCursor, limit: 1 })
    expect(first.isDone).toBe(false)
    expect(second.isDone).toBe(true)
    expect([...first.page, ...second.page].map((row) => row.id).sort()).toEqual(
      [srdSystemRecord.id, secondSystemId].sort()
    )
    const secondRow = [...first.page, ...second.page].find((row) => row.id === secondSystemId)
    expect(secondRow?.rulesCatalogues.map((row) => row.id)).toEqual([secondBootstrap.catalogue.id])
    const srdRow = [...first.page, ...second.page].find((row) => row.id === srdSystemRecord.id)
    expect(srdRow?.rulesCatalogues.map((row) => row.id)).toEqual([SRD_RULES_CATALOGUE.id])
    expect(JSON.stringify([first, second])).not.toMatch(
      /_id|_creationTime|contentSourceIds|checksum/
    )
    for (const limit of [0, 1.5, 11]) {
      await expect(t.query(list, { cursor: null, limit })).rejects.toThrow()
    }

    // 5. SRD content is imported; readers see it scoped to its System, in bounded pages.
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: srdSubjects
    })
    const zeroCounts = { activeCount: 0, masterCount: 0, ownedCount: 0 }
    const reader = t.withIdentity({ subject: 'ordinary-reader' })
    for (const caller of [t, reader]) {
      for (const subjectKind of ['BACKGROUND', 'FEAT', 'SPELL'] as const) {
        expect(
          await caller.query(api.content.catalogue.counts, {
            subjectKind,
            systemId: srdSystemRecord.id
          })
        ).toEqual({ activeCount: 1, masterCount: 1, ownedCount: 0 })
        expect(
          await caller.query(api.content.catalogue.counts, {
            subjectKind,
            systemId: secondSystemId
          })
        ).toEqual(zeroCounts)
      }
      expect(
        await caller.query(api.content.catalogue.counts, {
          subjectKind: 'CLASS',
          systemId: srdSystemRecord.id
        })
      ).toEqual(zeroCounts)
    }

    const pagedIds: string[] = []
    let cursor: string | null = null
    for (let isDone = false; !isDone; ) {
      const page: SourceImportAuditPageDto = await t.query(internal.content.import.readSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        paginationOpts: { numItems: 1, cursor }
      })
      expect(page.page.length).toBeLessThanOrEqual(1)
      pagedIds.push(...page.page.map((record) => record.id))
      cursor = page.continueCursor
      isDone = page.isDone
    }
    expect(pagedIds.sort()).toEqual(srdSubjects.map((subject) => subject.id).sort())
    for (const numItems of [0, 1.5, 11]) {
      await expect(
        t.query(internal.content.import.readSubjects, {
          contentSourceId: SRD_CONTENT_SOURCE.id,
          paginationOpts: { numItems, cursor: null }
        })
      ).rejects.toThrow('Import page size must be 1..10.')
    }
    await expect(
      t.query(internal.content.import.readSubjects, {
        contentSourceId: secondBootstrap.contentSource.id,
        paginationOpts: { numItems: 10, cursor: null }
      })
    ).resolves.toMatchObject({ page: [], isDone: true })
    expect(JSON.stringify(await reader.query(list, { cursor: null, limit: 10 }))).not.toMatch(
      /_id|_creationTime|contentSourceIds|checksum/
    )

    // 6. Every index the journey's reads rely on exists in the real schema. convex-test fails
    // a withIndex on an undefined index, so the passing reads above plus this check prove them.
    for (const [table, indexes] of Object.entries(journeyTables)) {
      const defined = schema.tables[table as keyof typeof journeyTables][' indexes']()
      for (const index of indexes) expect(defined).toContainEqual(index)
    }
  }, 120_000)
})
