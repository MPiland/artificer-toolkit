import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { publicationFixture } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { catalogue as catalogueManifest } from '../contentSnapshots/manifest'
import { counts } from './catalogue'

// ADR 0036: an authored-content list page reads content snapshot files, so its only Convex read is
// the catalogue manifest subscription, which touches one row per content source and one head per
// source and no authored content. Before the snapshots, a Class list page read about 0.9 MB, a Spell
// page 0.48 MB and the Spell summary 1.5 MB (37 MB before that read was bounded).
const HOMEBREW_SPELLS = 12
const MANIFEST_BUDGET_BYTES = 64 * 1024
const COUNTS_BUDGET_BYTES = 64 * 1024

const { subjects } = srdBaselineContent
const kinds = [
  'SPELL',
  'CLASS',
  'RACE',
  'EQUIPMENT',
  'CREATURE',
  'FEAT',
  'BACKGROUND',
  'VEHICLE'
] as const

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
  it('reads no authored content for a list page and bounds the counts with the full SRD plus Homebrew', async () => {
    const { first } = await seed()
    const manifest = await measure<{ sources: unknown[] }>(first.caller, catalogueManifest, {})
    expect(manifest.result.sources.length).toBeGreaterThan(0)
    expect(manifest.reads.bytes, 'catalogue manifest').toBeLessThanOrEqual(MANIFEST_BUDGET_BYTES)
    const report: Record<string, number> = {}
    for (const subjectKind of kinds) {
      const { reads } = await measure(first.caller, counts, {
        subjectKind,
        systemId: srdSystemRecord.id
      })
      report[subjectKind] = reads.bytes
      expect(reads.bytes, `${subjectKind} counts`).toBeLessThanOrEqual(COUNTS_BUDGET_BYTES)
    }
    console.info(
      'catalogue read budget (bytes)',
      JSON.stringify({ manifest: manifest.reads.bytes, counts: report })
    )
  }, 900_000)
})
