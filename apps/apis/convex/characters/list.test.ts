import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { CharacterListPage } from '@artificer-toolkit/schema/api/characterList'
import type { CharacterDraftListInput } from '@artificer-toolkit/schema/api/characterDrafts'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { api } from '../_generated/api'
import { input } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const list = makeFunctionReference<'query', CharacterDraftListInput, CharacterListPage>(
  'characters/list:list'
)

async function fixture() {
  const base = await readyCharacterFixture()
  const active = []
  for (let index = 0; index < 3; index++) {
    const { draft, character } = await base.createCharacter()
    const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    active.push({ character, committed })
  }
  const draftOnly = await base.owner.caller.mutation(api.characters.drafts.create, input())
  return { ...base, active, draftOnly }
}

const pageInput = (cursor: string | null = null, numItems = 48): CharacterDraftListInput => ({
  paginationOpts: { cursor, numItems }
})

describe('native personal Character list', () => {
  it('lists only owned active Characters, preserves route IDs, joins an edit draft, and excludes draft-only recovery', async () => {
    const { owner, other, t, active, draftOnly } = await fixture()
    const edit = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: active[0]!.character.id
    })
    const saved = await owner.caller.mutation(api.characters.drafts.save, {
      expectedDraftId: edit.id,
      characterId: active[0]!.character.id,
      mode: 'edit',
      character: { ...edit.payload.character, label: 'Edited active' }
    })
    const before = await t.run(async (ctx) => ({
      characters: await ctx.db.query('characters').collect(),
      drafts: await ctx.db.query('characterDrafts').collect()
    }))
    const result = await owner.caller.query(list, pageInput())
    const after = await t.run(async (ctx) => ({
      characters: await ctx.db.query('characters').collect(),
      drafts: await ctx.db.query('characterDrafts').collect()
    }))
    expect(after).toEqual(before)
    expect(result.page).toHaveLength(3)
    expect(result.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: active[0]!.character.id,
          publicId: active[0]!.committed.publicId,
          label: 'Edited active',
          status: 'ACTIVE',
          systemId: active[0]!.character.systemId,
          streamVersion: 1,
          draft: expect.objectContaining({
            characterId: saved.characterId,
            label: 'Edited active',
            draftState: 'ACTIVE_WITH_DRAFT'
          })
        })
      ])
    )
    expect(result.page.map((row) => row.id)).not.toContain(draftOnly.characterId)
    expect((await other.caller.query(list, pageInput())).page).toEqual([])
    await expect(t.query(list, pageInput())).rejects.toThrow('Unauthenticated')
  })

  it('paginates by the current-owner creation index without duplicates', async () => {
    const { owner, active } = await fixture()
    const found: string[] = []
    let cursor: string | null = null
    for (let pageNumber = 0; pageNumber < 5; pageNumber++) {
      const page: CharacterListPage = await owner.caller.query(list, pageInput(cursor, 1))
      found.push(...page.page.map((row) => row.id))
      if (page.isDone) break
      cursor = page.continueCursor
    }
    expect(found).toHaveLength(3)
    expect(new Set(found).size).toBe(found.length)
    expect(new Set(found)).toEqual(new Set(active.map(({ character }) => character.id)))
    const firstPage = await owner.caller.query(list, pageInput(null, 1))
    expect(firstPage.page[0]!.publicId).toBe(
      active.find(({ character }) => character.id === firstPage.page[0]!.id)!.committed.publicId
    )
  })

  it('does not evaluate current rules sources while listing', async () => {
    const { owner, t, active } = await fixture()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', human.id))
        .unique()
      if (!root) throw new Error('Missing Human source fixture.')
      await ctx.db.patch(root._id, { checksum: '0'.repeat(64) })
    })
    await expect(
      owner.caller.query(api.characters.builder.get, { id: active[0]!.character.id })
    ).rejects.toThrow('Stored authored content identity mismatch.')
    const result = await owner.caller.query(list, pageInput())
    expect(result.page.map((row) => row.id)).toEqual(
      expect.arrayContaining(active.map(({ character }) => character.id))
    )
  })

  it('fails closed for corrupted active checksums, route ownership, and draft ownership', async () => {
    const first = await fixture()
    await first.t.run(async (ctx) => {
      const row = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', first.active[0]!.character.id))
        .unique()
      if (!row) throw new Error('Missing active Character fixture.')
      await ctx.db.patch(row._id, { checksum: '0'.repeat(64) })
    })
    await expect(first.owner.caller.query(list, pageInput())).rejects.toThrow()

    const second = await fixture()
    await second.t.run(async (ctx) => {
      const route = await ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', second.active[0]!.character.id))
        .unique()
      if (!route) throw new Error('Missing Character route fixture.')
      await ctx.db.patch(route._id, { ownerUserId: second.other.userId })
    })
    await expect(second.owner.caller.query(list, pageInput())).rejects.toThrow()

    const third = await fixture()
    const edit = await third.owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: third.active[0]!.character.id
    })
    await third.t.run(async (ctx) => {
      const draft = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', third.active[0]!.character.id))
        .unique()
      if (!draft) throw new Error('Missing edit draft fixture.')
      await ctx.db.patch(draft._id, { userId: third.other.userId })
    })
    expect(edit.characterId).toBe(third.active[0]!.character.id)
    await expect(third.owner.caller.query(list, pageInput())).rejects.toThrow()
  })
})
