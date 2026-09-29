import { describe, expect, it } from 'vitest'
import type {
  AuthoredCataloguePage,
  AuthoredCatalogueReadInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { publicationFixture } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { list, summary } from './catalogue'

// Convex aborts a function that reads more than 16 MiB. With the full SRD (319 Spells) plus
// Homebrew, a list page costs its rows plus one System, one Source and the few Class roots its rows
// reference (a Class root is about 38 KB, so the Class page is the largest), and never rereads them
// per row. Before this bound, the Spell summary read 37 MB and a Spell page 4.6-5.7 MB.
const HOMEBREW_SPELLS = 12
const LIST_PAGE_BUDGET_BYTES = 1.25 * 1024 * 1024
const SUMMARY_BUDGET_BYTES = 2 * 1024 * 1024

const { subjects } = srdBaselineContent
const kinds = [
  ['SPELL', subjects.spells],
  ['CLASS', subjects.classes],
  ['RACE', subjects.races],
  ['EQUIPMENT', subjects.equipment],
  ['CREATURE', subjects.creatures],
  ['FEAT', subjects.feats],
  ['BACKGROUND', subjects.backgrounds],
  ['VEHICLE', subjects.vehicles]
] as const

type Kind = AuthoredCatalogueReadInput['subjectKind']
type Handler = (ctx: QueryCtx, args: unknown) => Promise<unknown>

function handlerOf(registered: object): Handler {
  if (!('_handler' in registered) || typeof registered._handler !== 'function')
    throw new Error('Missing registered query handler.')
  return registered._handler as Handler
}

async function seed() {
  const fixture = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    []
  )
  // The production seed also derives Class, Race and Equipment relationships and families.
  await fixture.t.action(internal.content.seed.seed, {})
  for (const spell of subjects.spells.slice(0, HOMEBREW_SPELLS)) {
    const draft = await fixture.first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'SPELL',
      subjectId: spell.id
    })
    if (!draft.updatedAt) throw new Error('Missing Spell draft revision')
    await fixture.first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'SPELL',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
  }
  return fixture
}

type Caller = Awaited<ReturnType<typeof seed>>['first']['caller']

async function measure<T>(caller: Caller, registered: object, args: unknown) {
  const totals = createDatabaseIoTotals()
  const handler = handlerOf(registered)
  const result = (await caller.run((ctx) =>
    handler({ ...ctx, db: countDatabaseIo(ctx.db, totals) } as unknown as QueryCtx, args)
  )) as T
  return { result, reads: totals.reads }
}

describe('catalogue read budget', () => {
  it('bounds every list page and summary with the full SRD plus Homebrew', async () => {
    const { first } = await seed()
    const report: Record<
      string,
      { pageBytes: number; nextPageBytes?: number; summaryBytes: number }
    > = {}
    for (const [kind] of kinds) {
      const scope = {
        subjectKind: kind as Kind,
        ...(kind === 'CLASS' || kind === 'RACE' ? { sort: 'family' as const } : {})
      }
      const page = await measure<AuthoredCataloguePage>(first.caller, list, {
        ...scope,
        paginationOpts: { cursor: null, numItems: 48 }
      })
      expect(page.result.page.length).toBeGreaterThan(0)
      const next = page.result.isDone
        ? null
        : await measure<AuthoredCataloguePage>(first.caller, list, {
            ...scope,
            paginationOpts: { cursor: page.result.continueCursor, numItems: 48 }
          })
      const overview = await measure(first.caller, summary, { subjectKind: kind })
      report[kind] = {
        pageBytes: page.reads.bytes,
        ...(next ? { nextPageBytes: next.reads.bytes } : {}),
        summaryBytes: overview.reads.bytes
      }
    }
    console.info('catalogue read budget (bytes)', JSON.stringify(report))
    for (const [kind, bytes] of Object.entries(report)) {
      expect(bytes.pageBytes, `${kind} first page`).toBeLessThanOrEqual(LIST_PAGE_BUDGET_BYTES)
      expect(bytes.nextPageBytes ?? 0, `${kind} next page`).toBeLessThanOrEqual(
        LIST_PAGE_BUDGET_BYTES
      )
      expect(bytes.summaryBytes, `${kind} summary`).toBeLessThanOrEqual(SUMMARY_BUDGET_BYTES)
    }
  }, 900_000)
})
