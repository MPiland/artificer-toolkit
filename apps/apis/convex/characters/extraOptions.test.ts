import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterSheetExtraCatalogReadInput,
  CharacterSheetExtraCatalogResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { cat as rawCat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { rowboat } from '@artificer-toolkit/source-data/srd/vehicles/rowboat.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api, internal } from '../_generated/api'
import { importedSubject } from '../../tests/fixtures/publication'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { srdCreatureRecord } from '../../tests/fixtures/srdCreatures'
import { readCharacterRow } from './stateDocuments'

const cat = srdCreatureRecord(rawCat.id)

const list = makeFunctionReference<
  'query',
  CharacterSheetExtraCatalogReadInput,
  CharacterSheetExtraCatalogResponseDto
>('characters/extraOptions:list')

const ids = {
  sameA: '10000000-0000-4000-8000-000000000201',
  sameB: '10000000-0000-4000-8000-000000000202',
  velvet: '10000000-0000-4000-8000-000000000203',
  vehicle: '10000000-0000-4000-8000-000000000204'
} as const

async function fixture() {
  const base = await readyCharacterFixture()
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        subjectKind: 'CREATURE',
        ...cat,
        id: ids.sameA,
        label: 'Same Name',
        document: { ...cat, id: ids.sameA, label: 'Same Name' }
      }),
      importedSubject({
        subjectKind: 'CREATURE',
        ...cat,
        id: ids.sameB,
        label: 'Same Name',
        document: { ...cat, id: ids.sameB, label: 'Same Name' }
      }),
      importedSubject({
        subjectKind: 'CREATURE',
        ...cat,
        id: ids.velvet,
        label: 'Velvet Cat',
        document: { ...cat, id: ids.velvet, label: 'Velvet Cat', description: 'needle-description' }
      }),
      importedSubject({
        subjectKind: 'VEHICLE',
        ...rowboat,
        id: ids.vehicle,
        label: 'Same Name',
        document: { ...rowboat, id: ids.vehicle, label: 'Same Name' }
      })
    ]
  })
  const { draft, character } = await base.createCharacter()
  const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  return { ...base, character, committed }
}

describe('native personal Character Sheet extra source options', () => {
  it('filters by kind and case-insensitive label substring, excluding description matches', async () => {
    const { owner, committed } = await fixture()
    expect(
      await owner.caller.query(list, { id: committed.publicId, kind: 'CREATURE', limit: 25 })
    ).toEqual({
      items: expect.arrayContaining([
        expect.objectContaining({ id: ids.sameA, label: 'Same Name' }),
        expect.objectContaining({ id: ids.sameB, label: 'Same Name' }),
        expect.objectContaining({ id: ids.velvet, label: 'Velvet Cat' })
      ]),
      nextCursor: null
    })
    expect(
      await owner.caller.query(list, { id: committed.publicId, kind: 'VEHICLE', limit: 25 })
    ).toEqual({
      items: [expect.objectContaining({ id: ids.vehicle, label: 'Same Name' })],
      nextCursor: null
    })
    expect(
      await owner.caller.query(list, {
        id: committed.publicId,
        kind: 'CREATURE',
        query: ' VELVET ',
        limit: 25
      })
    ).toEqual({
      items: [expect.objectContaining({ id: ids.velvet, label: 'Velvet Cat' })],
      nextCursor: null
    })
    expect(
      await owner.caller.query(list, {
        id: committed.publicId,
        kind: 'CREATURE',
        query: 'NEEDLE',
        limit: 25
      })
    ).toEqual({
      items: [],
      nextCursor: null
    })
    expect(
      await owner.caller.query(list, {
        id: committed.publicId,
        kind: 'CREATURE',
        query: '%',
        limit: 25
      })
    ).toEqual({
      items: [],
      nextCursor: null
    })
  })

  it('orders tied labels by UUID and resumes with the same comparison at the cursor', async () => {
    const { owner, committed } = await fixture()
    const first = await owner.caller.query(list, {
      id: committed.publicId,
      kind: 'CREATURE',
      limit: 1
    })
    expect(first.items).toHaveLength(1)
    expect(first.items[0]).toMatchObject({ id: ids.sameA, label: 'Same Name' })
    expect(first.nextCursor).toEqual({ id: ids.sameA, label: 'Same Name' })
    const second = await owner.caller.query(list, {
      id: committed.publicId,
      kind: 'CREATURE',
      limit: 1,
      cursor: first.nextCursor!
    })
    expect(second.items[0]).toMatchObject({ id: ids.sameB, label: 'Same Name' })
    expect(second.nextCursor).toEqual({ id: ids.sameB, label: 'Same Name' })
  })

  it('includes master and owner sources while excluding another owner, and does not write on query', async () => {
    const { owner, other, committed, t, character } = await fixture()
    const ownedDraft = await owner.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CREATURE',
      subjectId: ids.sameA
    })
    const owned = await owner.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: ownedDraft.subjectId,
      systemId: ownedDraft.systemId,
      label: 'Owner Cat',
      payload: { ...ownedDraft.payload, label: 'Owner Cat' }
    })
    await owner.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'CREATURE',
      subjectId: owned.subjectId,
      expectedDraftUpdatedAt: owned.updatedAt!
    })
    const foreignDraft = await other.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CREATURE',
      subjectId: ids.sameA
    })
    const foreign = await other.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: foreignDraft.subjectId,
      systemId: foreignDraft.systemId,
      label: 'Foreign Cat',
      payload: { ...foreignDraft.payload, label: 'Foreign Cat' }
    })
    await other.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'CREATURE',
      subjectId: foreign.subjectId,
      expectedDraftUpdatedAt: foreign.updatedAt!
    })
    const before = await t.run((ctx) => readCharacterRow(ctx, character.id))
    const result = await owner.caller.query(list, {
      id: committed.publicId,
      kind: 'CREATURE',
      limit: 25
    })
    expect(result.items.map(({ id }) => id)).toEqual(
      expect.arrayContaining([ids.sameA, owned.subjectId])
    )
    expect(result.items.map(({ id }) => id)).not.toContain(foreign.subjectId)
    const after = await t.run((ctx) => readCharacterRow(ctx, character.id))
    expect(after).toEqual(before)
  })

  it('rejects invalid bounds and fails closed on stale catalogue metadata', async () => {
    const { owner, committed, t } = await fixture()
    await expect(
      owner.caller.query(list, { id: committed.publicId, kind: 'CREATURE', limit: 0 })
    ).rejects.toThrow()
    await expect(
      owner.caller.query(list, { id: committed.publicId, kind: 'CREATURE', limit: 51 })
    ).rejects.toThrow()
    await expect(
      owner.caller.query(list, {
        id: committed.publicId,
        kind: 'CREATURE',
        limit: 25,
        cursor: { id: 'bad', label: 'Same Name' }
      })
    ).rejects.toThrow()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', ids.sameA))
        .unique()
      if (!root?.catalogue) throw new Error('Missing catalogue metadata fixture.')
      await ctx.db.patch(root._id, { catalogue: { ...root.catalogue, checksum: '0'.repeat(64) } })
    })
    await expect(
      owner.caller.query(list, { id: committed.publicId, kind: 'CREATURE', limit: 25 })
    ).rejects.toThrow(/stale|metadata/i)
  })

  it('rejects missing or foreign characters and anonymous access', async () => {
    const { owner, other, committed, t } = await fixture()
    await expect(
      owner.caller.query(list, { id: crypto.randomUUID(), kind: 'CREATURE', limit: 25 })
    ).rejects.toThrow()
    await expect(
      other.caller.query(list, { id: committed.publicId, kind: 'CREATURE', limit: 25 })
    ).rejects.toThrow()
    await expect(
      t.query(list, { id: committed.publicId, kind: 'CREATURE', limit: 25 })
    ).rejects.toThrow()
  })
})
