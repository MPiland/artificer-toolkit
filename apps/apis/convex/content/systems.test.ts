import { makeFunctionReference } from 'convex/server'
import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import {
  type SystemListPageDto,
  type SystemListItemDto,
  type SystemListPageInputDto,
  type SystemLookupInputDto,
  type SystemResponseDto
} from '@artificer-toolkit/schema/api/systems'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { internal } from '../_generated/api'
import schema from '../schema'
import { ensureSystemVocabularySnapshot } from './systemVocabulary'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const get = makeFunctionReference<'query', SystemLookupInputDto, SystemResponseDto>(
  'content/systems:get'
)
const list = makeFunctionReference<'query', SystemListPageInputDto, SystemListPageDto>(
  'content/systems:list'
)
const summary = makeFunctionReference<'query', SystemLookupInputDto, SystemListItemDto | null>(
  'content/systems:summary'
)
const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
const system = { id: srdSystemRecord.id, document, checksum: checksumRuleDocument(document) }
const firstPage = { cursor: null, limit: 10 }

function checksumSystemVocabularySnapshot({
  checksum: _checksum,
  ...checksummed
}: Awaited<ReturnType<typeof ensureSystemVocabularySnapshot>>) {
  return checksumCanonicalJson(checksummed)
}

async function fixture() {
  const t = convexTest(schema, modules)
  await t.mutation(internal.content.import.bootstrap, {
    systems: [system],
    contentSource: SRD_CONTENT_SOURCE,
    catalogue: SRD_RULES_CATALOGUE
  })
  return t
}

describe('public platform System reads', () => {
  it('pins an immutable vocabulary snapshot and reuses it on bootstrap replay', async () => {
    const t = await fixture()
    const before = await t.run((ctx) => ensureSystemVocabularySnapshot(ctx, system.id))
    expect(before.checksum).toBe(checksumSystemVocabularySnapshot(before))
    expect(before.snapshotVersion).toBe(1)
    await t.mutation(internal.content.import.bootstrap, {
      systems: [system],
      contentSource: SRD_CONTENT_SOURCE,
      catalogue: SRD_RULES_CATALOGUE
    })
    expect(await t.run((ctx) => ensureSystemVocabularySnapshot(ctx, system.id))).toEqual(before)
  })

  it('initializes existing Systems and refuses corrupted or mismatched vocabulary', async () => {
    const t = convexTest(schema, modules)
    await t.run((ctx) => ctx.db.insert('systems', system))
    const snapshot = await t.run((ctx) => ensureSystemVocabularySnapshot(ctx, system.id))
    const row = await t.run((ctx) =>
      ctx.db
        .query('systemVocabularySnapshots')
        .withIndex('by_snapshotId', (q) => q.eq('snapshotId', snapshot.snapshotId))
        .unique()
    )
    if (!row) throw new Error('Missing vocabulary snapshot.')
    await t.run((ctx) => ctx.db.patch(row._id, { checksum: '0'.repeat(64) }))
    await expect(t.run((ctx) => ensureSystemVocabularySnapshot(ctx, system.id))).rejects.toThrow(
      'checksum mismatch'
    )
    const changed = { ...snapshot, document: { ...snapshot.document, label: 'Changed System' } }
    await t.run((ctx) =>
      ctx.db.patch(row._id, {
        document: changed.document,
        checksum: checksumSystemVocabularySnapshot(changed)
      })
    )
    await expect(t.run((ctx) => ensureSystemVocabularySnapshot(ctx, system.id))).rejects.toThrow(
      'does not match the current System'
    )
  })

  it('rejects an unpaired System before bootstrap can expose either System publicly', async () => {
    const t = convexTest(schema, modules)
    const extraId = 'a0000000-0000-4000-8000-000000000001'
    const extraDocument = jsonValueSchema.parse({ ...srdSystemRecord, id: extraId })
    await expect(
      t.mutation(internal.content.import.bootstrap, {
        systems: [
          system,
          { id: extraId, document: extraDocument, checksum: checksumRuleDocument(extraDocument) }
        ],
        contentSource: SRD_CONTENT_SOURCE,
        catalogue: SRD_RULES_CATALOGUE
      })
    ).rejects.toThrow()
    expect((await t.query(list, firstPage)).page).toEqual([])
    expect(await t.query(get, { id: extraId })).toBeNull()
    expect(await t.run((ctx) => ctx.db.query('contentSources').take(1))).toEqual([])
  })

  it('returns exact canonical data to anonymous and signed-in readers without internal IDs', async () => {
    const t = await fixture()
    const result = await t.query(list, firstPage)
    expect(result.isDone).toBe(true)
    expect(result.page).toEqual([
      {
        id: system.id,
        label: srdSystemRecord.label,
        description: srdSystemRecord.description ?? null,
        rulesetCode: srdSystemRecord.rulesetCode,
        rulesetVersion: srdSystemRecord.rulesetVersion,
        userId: srdSystemRecord.userId,
        rulesCatalogues: [
          {
            id: SRD_RULES_CATALOGUE.id,
            label: SRD_RULES_CATALOGUE.label,
            description: SRD_RULES_CATALOGUE.description
          }
        ]
      }
    ])
    const detail = await t.query(get, { id: system.id.toUpperCase() })
    expect(await t.query(summary, { id: system.id.toUpperCase() })).toEqual(result.page[0])
    expect(await t.query(summary, { id: 'a0000000-0000-4000-8000-000000000009' })).toBeNull()
    expect(detail).toEqual(document)
    expect(checksumRuleDocument(jsonValueSchema.parse(detail))).toBe(system.checksum)
    const reader = t.withIdentity({ subject: 'ordinary-reader' })
    expect(await reader.query(get, { id: system.id })).toEqual(detail)
    expect(await reader.query(list, firstPage)).toEqual(result)
    expect(JSON.stringify(result)).not.toMatch(/_id|_creationTime|contentSourceIds|checksum/)
  })

  it('paginates System summaries without dropping a System or mixing its catalogues', async () => {
    const t = await fixture()
    const secondId = 'a0000000-0000-4000-8000-000000000001'
    const secondDocument = jsonValueSchema.parse({ ...srdSystemRecord, id: secondId })
    await t.mutation(internal.content.import.bootstrap, {
      systems: [
        { id: secondId, document: secondDocument, checksum: checksumRuleDocument(secondDocument) }
      ],
      contentSource: {
        ...SRD_CONTENT_SOURCE,
        id: 'a0000000-0000-4000-8000-000000000002',
        gameSystemId: secondId
      },
      catalogue: {
        ...SRD_RULES_CATALOGUE,
        id: 'a0000000-0000-4000-8000-000000000003',
        gameSystemId: secondId
      }
    })
    const first = await t.query(list, { cursor: null, limit: 1 })
    const second = await t.query(list, { cursor: first.continueCursor, limit: 1 })
    expect(first.isDone).toBe(false)
    expect(second.isDone).toBe(true)
    expect(first.page.map((row) => row.id)).toEqual([system.id])
    expect(second.page.map((row) => row.id)).toEqual([secondId])
    expect(second.page[0].rulesCatalogues.map((row) => row.id)).toEqual([
      'a0000000-0000-4000-8000-000000000003'
    ])
  })

  it('distinguishes a missing System from malformed IDs and enforces page bounds', async () => {
    const t = convexTest(schema, modules)
    expect(await t.query(get, { id: system.id })).toBeNull()
    expect((await t.query(list, firstPage)).page).toEqual([])
    await expect(t.query(get, { id: 'not-a-uuid' })).rejects.toThrow()
    for (const limit of [0, 1.5, 11]) {
      await expect(t.query(list, { cursor: null, limit })).rejects.toThrow()
    }
  })

  it('rejects stored corruption instead of serving a stale checksum or mismatched identity', async () => {
    const t = await fixture()
    const id = await t.run(
      async (ctx) => (await ctx.db.query('systems').withIndex('by_publicId').unique())!._id
    )
    await t.run((ctx) => ctx.db.patch(id, { checksum: '0'.repeat(64) }))
    await expect(t.query(get, { id: system.id })).rejects.toThrow('checksum mismatch')
    await expect(t.query(list, firstPage)).rejects.toThrow('checksum mismatch')
    const changed = jsonValueSchema.parse({
      ...srdSystemRecord,
      id: 'a0000000-0000-4000-8000-000000000004'
    })
    await t.run((ctx) =>
      ctx.db.patch(id, { document: changed, checksum: checksumRuleDocument(changed) })
    )
    await expect(t.query(get, { id: system.id })).rejects.toThrow('identity mismatch')
  })

  it.each(['missing', 'foreign', 'duplicate', 'empty'] as const)(
    'rejects a %s catalogue source binding',
    async (kind) => {
      const t = await fixture()
      await t.run(async (ctx) => {
        const source = await ctx.db.query('contentSources').withIndex('by_publicId').unique()
        const catalogue = await ctx.db.query('rulesCatalogues').withIndex('by_publicId').unique()
        if (!source || !catalogue) throw new Error('Missing fixture')
        if (kind === 'missing') await ctx.db.delete(source._id)
        if (kind === 'foreign') {
          await ctx.db.patch(source._id, {
            gameSystemId: 'a0000000-0000-4000-8000-000000000005'
          })
        }
        if (kind === 'duplicate') {
          await ctx.db.patch(catalogue._id, { contentSourceIds: [source.id, source.id] })
        }
        if (kind === 'empty') await ctx.db.patch(catalogue._id, { contentSourceIds: [] })
      })
      await expect(t.query(list, firstPage)).rejects.toThrow(/catalogue content source/)
      await expect(t.query(summary, { id: system.id })).rejects.toThrow(/catalogue content source/)
    }
  )

  it('rejects catalogue overflow rather than returning an incomplete selection list', async () => {
    const t = await fixture()
    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index++) {
        await ctx.db.insert('rulesCatalogues', {
          ...SRD_RULES_CATALOGUE,
          id: `a0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          contentSourceIds: [SRD_CONTENT_SOURCE.id]
        })
      }
    })
    await expect(t.query(list, firstPage)).rejects.toThrow('catalogue limit exceeded')
    await expect(t.query(summary, { id: system.id })).rejects.toThrow('catalogue limit exceeded')
  })
})
