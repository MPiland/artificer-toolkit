import { describe, expect, it } from 'vitest'
import type { AuthoredSourceRoots } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { handlerOf } from '../../tests/fixtures/queryTransaction'
import { api } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import { readSourceRows } from '../content/classPublication'
import { createAuthoredSourceReader } from './authoredSources'

const { subjects } = srdBaselineContent
const spells = subjects.spells.slice(0, 3)
// Each root table the reader can serve from roots alone, with SRD subjects that stand on their own.
const rootTables = [
  { table: 'spells', subjectKind: 'SPELL', records: spells, column: 'magic_school_id' },
  {
    table: 'classes',
    subjectKind: 'CLASS',
    records: subjects.classes.filter((record) => record.category !== 'SUBCLASS').slice(0, 3),
    column: 'category'
  },
  {
    table: 'equipment',
    subjectKind: 'EQUIPMENT',
    records: subjects.equipment.slice(0, 3),
    column: 'category'
  },
  {
    table: 'races',
    subjectKind: 'RACE',
    records: subjects.races.filter((record) => record.category === 'BASE').slice(0, 3),
    column: 'category'
  }
] as const

// PERF-6.T5: a Class's 353-Spell list read 750 documents and 790 KB, each Spell's root and its
// import job. Labels now come from each Spell's Class list row, and each import job is read once:
// 358 documents and 675 KB, most of it the selector entry each row carries.
const LIST_SPELLS = 353
const LIST_READ_DOCUMENTS = 360
const LIST_READ_BYTES = 680_000

/** Moves a Spell's root and Class list rows into an import job, as that job's import wrote them. */
async function moveIntoImportJob(ctx: MutationCtx, spellId: string, importJobId: string) {
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (query) => query.eq('id', spellId))
    .unique()
  if (!root) throw new Error('Missing Spell root.')
  await ctx.db.patch(root._id, { importJobId })
  const rows = await ctx.db
    .query('authoredSpellClasses')
    .withIndex('by_spellId', (query) => query.eq('spellId', spellId))
    .collect()
  if (!rows.length) throw new Error('Expected Class list rows.')
  for (const row of rows) await ctx.db.patch(row._id, { importJobId })
}

function insertImportJob(
  ctx: MutationCtx,
  { id, ownerUserId, status }: { id: string; ownerUserId: string; status: 'RUNNING' | 'COMPLETED' }
) {
  const previewId = crypto.randomUUID()
  const now = new Date().toISOString()
  return ctx.db.insert('importJobs', {
    id,
    ownerUserId,
    previewId,
    command: {
      commandId: crypto.randomUUID(),
      previewId,
      selectedEntryIds: [],
      resolutions: [],
      customContentChoices: []
    },
    inputFingerprint: '0'.repeat(64),
    source: 'ARTIFICER_JSON',
    status,
    terminalStatus: null,
    phase: 'STAGING',
    entryIndex: 0,
    cursor: null,
    processedEntries: 0,
    totalEntries: 1,
    expectedStageCount: 1,
    stagedStageCount: 1,
    failureReason: null,
    summary: null,
    cleanupTableIndex: 0,
    cleanupCursor: null,
    expiresAt: Date.now() + 60_000,
    createdAt: now,
    updatedAt: now
  })
}

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    rootTables.map(({ subjectKind, records }) =>
      records.map((record) => importedSubject({ subjectKind, ...record, document: record }))
    )
  )
}

describe('authored source reader', () => {
  it('reads named roots by key, serving an id-and-label read from the roots exactly as their facts would', async () => {
    const { t, first, second } = await fixture()
    const copy = await second.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'SPELL',
      subjectId: spells[0]!.id
    })
    const saved = await second.caller.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: copy.subjectId,
      systemId: copy.systemId,
      label: 'Private homebrew',
      payload: copy.payload
    })
    if (!saved.updatedAt) throw new Error('Missing draft revision')
    await second.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'SPELL',
      subjectId: saved.subjectId,
      expectedDraftUpdatedAt: saved.updatedAt
    })
    const roots: AuthoredSourceRoots = {
      by: 'ID',
      ids: [...spells.map((spell) => spell.id), saved.subjectId]
    }

    const read = (userId: string, columns: readonly string[]) =>
      t.run((ctx) =>
        createAuthoredSourceReader(ctx, srdSystemRecord.id, userId)('spells', roots, columns)
      )
    const fromRoots = await read(first.userId, ['id', 'label'])
    const fromFacts = await read(first.userId, ['id', 'label', 'magic_school_id'])

    expect(fromRoots).toEqual(fromFacts.map(({ id, label }) => ({ id, label })))
    expect(fromRoots.map((row) => row.id).sort()).toEqual(spells.map((spell) => spell.id).sort())
    expect((await read(second.userId, ['id', 'label'])).map((row) => row.label)).toContain(
      'Private homebrew'
    )
  })

  it('serves every root table its id and label exactly as the facts hold them', async () => {
    const { t, first } = await fixture()
    for (const { table, records, column } of rootTables) {
      const read = (columns: readonly string[]) =>
        t.run((ctx) =>
          createAuthoredSourceReader(ctx, srdSystemRecord.id, first.userId)(
            table,
            { by: 'ID', ids: records.map((record) => record.id) },
            columns
          )
        )
      const fromFacts = await read(['id', 'label', column])
      expect(fromFacts, table).toHaveLength(records.length)
      expect(await read(['id', 'label']), table).toEqual(
        fromFacts.map(({ id, label }) => ({ id, label }))
      )
    }
  })

  it('hides a Spell from an unfinished import, but not a Spell beside a leftover row of that import', async () => {
    const { t, first } = await fixture()
    const [hidden, ...shown] = spells
    await t.run(async (ctx) => {
      const importJobId = crypto.randomUUID()
      await insertImportJob(ctx, { id: importJobId, ownerUserId: first.userId, status: 'RUNNING' })
      await moveIntoImportJob(ctx, hidden!.id, importJobId)
      // The unfinished import's row sorts first, ahead of the rows the visible import wrote.
      const visibleRows = await ctx.db
        .query('authoredSpellClasses')
        .withIndex('by_spellId', (query) => query.eq('spellId', shown[0]!.id))
        .collect()
      if (!visibleRows.length) throw new Error('Expected Class list rows.')
      for (const row of visibleRows) await ctx.db.delete(row._id)
      for (const [
        index,
        { _id: _rowId, _creationTime: _created, ...row }
      ] of visibleRows.entries()) {
        if (index === 0)
          await ctx.db.insert('authoredSpellClasses', {
            ...row,
            importJobId,
            entry: { ...row.entry, label: 'Unfinished import' }
          })
        await ctx.db.insert('authoredSpellClasses', row)
      }
    })
    const read = await t.run((ctx) =>
      createAuthoredSourceReader(ctx, srdSystemRecord.id, first.userId)(
        'spells',
        { by: 'ID', ids: spells.map((spell) => spell.id) },
        ['id', 'label']
      )
    )
    expect(read.map((row) => row.id).sort()).toEqual(shown.map((spell) => spell.id).sort())
    expect(read.map((row) => row.label)).not.toContain('Unfinished import')
  })

  it('reads a 353-Spell list from its Class list rows, each import job once', async () => {
    const listed = Array.from({ length: LIST_SPELLS }, (_, index) => {
      const spell = subjects.spells[index % subjects.spells.length]!
      return index < subjects.spells.length
        ? spell
        : { ...spell, id: crypto.randomUUID(), label: `${spell.label} ${index}` }
    })
    const batches = []
    for (let start = 0; start < listed.length; start += 10)
      batches.push(
        listed
          .slice(start, start + 10)
          .map((spell) => importedSubject({ subjectKind: 'SPELL', ...spell, document: spell }))
      )
    const { t, first } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      batches
    )
    // Two finished imports own the list, as a seed and a later import would.
    const importJobIds = [crypto.randomUUID(), crypto.randomUUID()]
    await t.run(async (ctx) => {
      for (const id of importJobIds)
        await insertImportJob(ctx, { id, ownerUserId: first.userId, status: 'COMPLETED' })
      for (const [index, spell] of listed.entries())
        await moveIntoImportJob(ctx, spell.id, importJobIds[index % importJobIds.length]!)
    })
    const totals = createDatabaseIoTotals()
    const rows: unknown = JSON.parse(
      await first.caller.run((ctx) =>
        handlerOf<string>(readSourceRows)(
          { ...ctx, db: countDatabaseIo(ctx.db, totals) },
          {
            systemId: srdSystemRecord.id,
            table: 'spells',
            columns: ['id', 'label'],
            roots: { by: 'ID', ids: listed.map((spell) => spell.id) }
          }
        )
      )
    )
    console.info(
      `${LIST_SPELLS}-Spell list read: ${totals.reads.documents} documents, ` +
        `${Math.round(totals.reads.bytes / 1000)} KB, ` +
        `${totals.reads.byTable.importJobs?.documents ?? 0} import jobs`
    )
    expect(rows).toHaveLength(LIST_SPELLS)
    expect(totals.reads.byTable.importJobs?.documents).toBe(importJobIds.length)
    expect(totals.reads.byTable.authoredRoots?.documents ?? 0).toBe(0)
    expect(totals.reads.documents).toBeLessThanOrEqual(LIST_READ_DOCUMENTS)
    expect(totals.reads.bytes).toBeLessThanOrEqual(LIST_READ_BYTES)
  }, 600_000)
})
