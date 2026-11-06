import { describe, expect, it } from 'vitest'
import type { AuthoredSourceRoots } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { api } from '../_generated/api'
import { createAuthoredSourceReader } from './authoredSources'

const spells = srdBaselineContent.subjects.spells.slice(0, 3)

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [spells.map((spell) => importedSubject({ subjectKind: 'SPELL', ...spell, document: spell }))]
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
})
