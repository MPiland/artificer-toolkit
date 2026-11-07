import { describe, expect, it } from 'vitest'
import type { AuthoredSourceRoots } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { api } from '../_generated/api'
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
})
