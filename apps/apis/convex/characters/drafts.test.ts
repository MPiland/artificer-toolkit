import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { characterDraftSaveErrorDataSchema } from '@artificer-toolkit/schema/api/characterDrafts'
import { describe, expect, it, vi } from 'vitest'
import type { CharacterBuilderDraftDto } from '@artificer-toolkit/schema/api/characterBuilder'
import type {
  CharacterDraftCreateInput,
  CharacterDraftDiscardInput,
  CharacterDraftListInput,
  CharacterDraftListPage,
  CharacterDraftLookupInput,
  CharacterDraftSaveInput
} from '@artificer-toolkit/schema/api/characterDrafts'
import { encodeCharacterRecord } from '@artificer-toolkit/schema/projections/characterStoredState'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { ensureAuthoredRouteId } from '../content/routeIds'
import { insertActiveCharacterRecord } from '../../tests/fixtures/characterRows'
import { fixture, input } from '../../tests/fixtures/characters'
import { deleteCharacterDraftPayloadByHead, insertCharacterDraftPayload } from './documents'
import { writeCharacterOperationalStructure } from './operationalWrites'
import { readCharacterRow } from './stateDocuments'

const create = makeFunctionReference<
  'mutation',
  CharacterDraftCreateInput,
  CharacterBuilderDraftDto
>('characters/drafts:create')
const save = makeFunctionReference<'mutation', CharacterDraftSaveInput, CharacterBuilderDraftDto>(
  'characters/drafts:save'
)
const get = makeFunctionReference<
  'query',
  CharacterDraftLookupInput,
  CharacterBuilderDraftDto | null
>('characters/drafts:get')
const list = makeFunctionReference<'query', CharacterDraftListInput, CharacterDraftListPage>(
  'characters/drafts:list'
)
const discard = makeFunctionReference<'mutation', CharacterDraftDiscardInput, { ok: true }>(
  'characters/drafts:discard'
)

async function activate(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  draft: CharacterBuilderDraftDto
) {
  return t.run(async (ctx) => {
    const stored = await ctx.db
      .query('characterDrafts')
      .withIndex('by_characterId', (q) => q.eq('characterId', draft.characterId))
      .unique()
    if (!stored) throw new Error('Missing draft fixture.')
    await ctx.db.delete(stored._id)
    const character = {
      ...draft.payload.character,
      label: 'Active character',
      status: 'ACTIVE' as const
    }
    return insertActiveCharacterRecord(ctx, character, { createdAt: new Date().toISOString() })
  })
}

describe('native Character working drafts', () => {
  it('requires authentication and isolates create, recovery, save, aliases and discard by owner', async () => {
    const { t, owner, other } = await fixture()
    const request = input()
    await expect(t.mutation(create, request)).rejects.toThrow('Unauthenticated')
    await expect(t.query(get, { id: request.id })).rejects.toThrow('Unauthenticated')
    await expect(t.query(list, { paginationOpts: { cursor: null, numItems: 10 } })).rejects.toThrow(
      'Unauthenticated'
    )
    await expect(
      t.mutation(discard, { id: request.id, expectedDraftId: crypto.randomUUID() })
    ).rejects.toThrow('Unauthenticated')
    const draft = await owner.caller.mutation(create, { ...request, id: request.id.toUpperCase() })
    expect(draft.characterId).toBe(request.id)
    expect(draft.payload.character).toMatchObject({
      id: request.id,
      userId: owner.userId,
      status: 'DRAFT'
    })
    expect(draft.draftState).toBe('DRAFT_ONLY')
    expect(draft.payload.character).not.toHaveProperty('primaryRulesCatalogueId')
    expect(draft.baseActiveUpdatedAt).toBeNull()
    expect(await owner.caller.mutation(create, request)).toEqual(draft)
    expect(await owner.caller.query(get, { id: draft.publicId })).toEqual(draft)
    expect(await other.caller.query(get, { id: request.id })).toBeNull()
    expect(await other.caller.query(get, { id: draft.publicId })).toBeNull()
    await expect(other.caller.mutation(create, request)).rejects.toThrow('current user')
    await expect(
      other.caller.mutation(save, {
        expectedDraftId: draft.id,
        characterId: request.id,
        character: draft.payload.character,
        mode: 'create'
      })
    ).rejects.toThrow('current user')
    await expect(
      other.caller.mutation(save, {
        expectedDraftId: crypto.randomUUID(),
        characterId: request.id,
        character: draft.payload.character,
        mode: 'create'
      })
    ).rejects.toThrow('Character draft is unavailable for the current user')
    await other.caller.mutation(discard, { id: draft.publicId, expectedDraftId: draft.id })
    expect(await owner.caller.query(get, { id: request.id })).toEqual(draft)
    const saved = await owner.caller.mutation(save, {
      expectedDraftId: draft.id,
      characterId: request.id,
      character: {
        ...draft.payload.character,
        userId: other.userId,
        label: 'Working choice',
        status: 'ACTIVE'
      },
      mode: 'create',
      builderIntent: { abilities: { activeMethod: 'POINT_BUY', methods: {} } }
    })
    expect(saved.payload.character).toMatchObject({
      userId: owner.userId,
      status: 'DRAFT',
      label: 'Working choice'
    })
    expect(saved.payload.builderIntent?.abilities?.activeMethod).toBe('POINT_BUY')
    expect(saved.id).toBe(draft.id)
    expect(saved.updatedAt! > draft.updatedAt!).toBe(true)
    await owner.caller.mutation(discard, { id: request.id, expectedDraftId: draft.id })
    expect(await owner.caller.query(get, { id: request.id })).toBeNull()
    const staleSave: CharacterDraftSaveInput = {
      expectedDraftId: draft.id,
      characterId: request.id,
      character: saved.payload.character,
      mode: 'create'
    }
    await expect(owner.caller.mutation(save, staleSave)).rejects.toThrow('draft is unavailable')
    // No draft row exists, so there is nothing of the owner's to hide from another user.
    await expect(other.caller.mutation(save, staleSave)).rejects.toThrow('DRAFT_REPLACED')
    await expect(other.caller.mutation(create, request)).rejects.toThrow('route is not available')
    const reopened = await owner.caller.mutation(create, request)
    expect(reopened.publicId).toBe(draft.publicId)
    expect(reopened.id).not.toBe(draft.id)
    await expect(owner.caller.mutation(save, staleSave)).rejects.toThrow('generation changed')
    await expect(
      owner.caller.mutation(discard, {
        id: request.id,
        expectedDraftId: draft.id
      })
    ).rejects.toThrow('generation changed')
    expect(await owner.caller.query(get, { id: request.id })).toEqual(reopened)
  }, 15_000)

  it('reports a replaced draft as a typed DRAFT_REPLACED error, and a foreign draft as a plain one', async () => {
    const { t, owner, other } = await fixture()
    const request = input()
    const draft = await owner.caller.mutation(create, request)
    const saveInput: CharacterDraftSaveInput = {
      expectedDraftId: draft.id,
      characterId: request.id,
      character: draft.payload.character,
      mode: 'create'
    }
    const replacedBy = async (promise: Promise<unknown>) => {
      const error = await promise.then(
        () => null,
        (reason: unknown) => reason
      )
      if (!(error instanceof ConvexError)) throw new Error('Expected a ConvexError.')
      return characterDraftSaveErrorDataSchema.parse(error.data)
    }
    // Another user's draft stays a plain error: nothing the owner's client should stop on.
    const foreign = await other.caller.mutation(save, saveInput).catch((reason: unknown) => reason)
    expect(foreign).not.toBeInstanceOf(ConvexError)
    // The generation was reopened elsewhere.
    await expect(
      replacedBy(
        owner.caller.mutation(save, { ...saveInput, expectedDraftId: crypto.randomUUID() })
      )
    ).resolves.toMatchObject({ code: 'DRAFT_REPLACED' })
    // The base revision moved on.
    await expect(
      replacedBy(owner.caller.mutation(save, { ...saveInput, baseActiveUpdatedAt: '2000-01-01' }))
    ).resolves.toMatchObject({ code: 'DRAFT_REPLACED' })
    // The draft was committed or discarded elsewhere.
    await owner.caller.mutation(discard, { id: request.id, expectedDraftId: draft.id })
    await expect(replacedBy(owner.caller.mutation(save, saveInput))).resolves.toMatchObject({
      code: 'DRAFT_REPLACED'
    })
    expect(await t.run((ctx) => ctx.db.query('characterDrafts').collect())).toHaveLength(0)
  })

  it('cannot reserve a future seeded authored UUID through a Character draft', async () => {
    const { t, owner } = await fixture()
    const reserved = '00000000-0000-0000-ffff-000100000000'
    await expect(owner.caller.mutation(create, { ...input(), id: reserved })).rejects.toThrow()
    await t.run(async (ctx) => {
      expect(await ctx.db.query('characterDrafts').collect()).toHaveLength(0)
      expect(await ensureAuthoredRouteId(ctx, 'BACKGROUND', reserved, true)).toBeTruthy()
    })
  })

  it('does not resurrect a discarded draft when save and discard race', async () => {
    const { owner } = await fixture()
    const draft = await owner.caller.mutation(create, input())
    const saveInput: CharacterDraftSaveInput = {
      expectedDraftId: draft.id,
      characterId: draft.characterId,
      character: { ...draft.payload.character, label: 'In-flight save' },
      mode: 'create'
    }
    const [saved, discarded] = await Promise.allSettled([
      owner.caller.mutation(save, saveInput),
      owner.caller.mutation(discard, { id: draft.characterId, expectedDraftId: draft.id })
    ])
    expect(discarded.status).toBe('fulfilled')
    if (saved.status === 'rejected') expect(String(saved.reason)).toContain('draft is unavailable')
    expect(await owner.caller.query(get, { id: draft.characterId })).toBeNull()
    await expect(owner.caller.mutation(save, saveInput)).rejects.toThrow('draft is unavailable')
  })

  it('paginates payload-free private summaries and never exposes storage IDs or checksums', async () => {
    const { owner, other } = await fixture()
    const expected: string[] = []
    for (let index = 0; index < 3; index++)
      expected.push((await owner.caller.mutation(create, input())).characterId)
    await other.caller.mutation(create, input())
    let cursor: string | null = null
    const found: string[] = []
    for (let index = 0; index < 3; index++) {
      const result: CharacterDraftListPage = await owner.caller.query(list, {
        paginationOpts: { cursor, numItems: 1 }
      })
      expect(result.page).toHaveLength(1)
      const summary = result.page[0]!
      expect(summary.userId).toBe(owner.userId)
      for (const key of ['payload', 'payloadJson', 'checksum', '_id', '_creationTime'])
        expect(summary).not.toHaveProperty(key)
      found.push(summary.characterId)
      cursor = result.continueCursor
    }
    expect(found.sort()).toEqual(expected.sort())
  })

  it('rejects identity and immutable System changes, and checks System integrity on open', async () => {
    const { t, owner } = await fixture()
    const request = input()
    const draft = await owner.caller.mutation(create, request)
    await expect(
      owner.caller.mutation(save, {
        characterId: crypto.randomUUID(),
        expectedDraftId: draft.id,
        character: draft.payload.character,
        mode: 'create'
      })
    ).rejects.toThrow('identities do not match')
    await expect(
      owner.caller.mutation(save, {
        characterId: request.id,
        character: { ...draft.payload.character, systemId: crypto.randomUUID() },
        expectedDraftId: draft.id,
        mode: 'create'
      })
    ).rejects.toThrow('immutable')
    await expect(
      owner.caller.mutation(create, { ...request, systemId: crypto.randomUUID() })
    ).rejects.toThrow('immutable')
    await expect(
      owner.caller.mutation(create, { ...input(), systemId: crypto.randomUUID() })
    ).rejects.toThrow('Game System is unavailable')
    const retiredCatalogueInput = { ...input(), primaryRulesCatalogueId: crypto.randomUUID() }
    await expect(owner.caller.mutation(create, retiredCatalogueInput)).rejects.toThrow()
    const retiredSaveInput = {
      characterId: request.id,
      character: { ...draft.payload.character, primaryRulesCatalogueId: crypto.randomUUID() },
      expectedDraftId: draft.id,
      mode: 'create' as const
    }
    await expect(owner.caller.mutation(save, retiredSaveInput)).rejects.toThrow()
    await t.run(async (ctx) => {
      const system = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', request.systemId))
        .unique()
      if (!system) throw new Error('Missing System fixture.')
      await ctx.db.patch(system._id, { checksum: '0'.repeat(64) })
    })
    // Autosave is structural and does not read the System; reopening checks it.
    await expect(owner.caller.mutation(create, request)).rejects.toThrow('System checksum mismatch')
    expect(await owner.caller.query(get, { id: request.id })).toEqual(draft)
  })

  it('replays concurrent creation once and enforces the union of active Characters and drafts', async () => {
    const { t, owner } = await fixture()
    const request = input()
    const [first, replay] = await Promise.all([
      owner.caller.mutation(create, request),
      owner.caller.mutation(create, request)
    ])
    expect(replay).toEqual(first)
    await activate(t, first)
    const edit = await owner.caller.mutation(create, request)
    expect(edit.draftState).toBe('ACTIVE_WITH_DRAFT')
    for (let index = 1; index < 6; index++) await owner.caller.mutation(create, input())
    await expect(owner.caller.mutation(create, input())).rejects.toThrow('personalCharacters limit')
    expect(
      (
        await owner.caller.mutation(save, {
          characterId: request.id,
          character: edit.payload.character,
          expectedDraftId: edit.id,
          mode: 'edit'
        })
      ).characterId
    ).toBe(request.id)
    await t.run(async (ctx) => {
      const routes = await ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', request.id))
        .take(2)
      const drafts = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', request.id))
        .take(2)
      expect(routes).toHaveLength(1)
      expect(drafts).toHaveLength(1)
    })
  })

  it('preserves the original edit token and leaves active Sheet state unchanged on save and discard', async () => {
    const { t, owner } = await fixture()
    const request = input()
    const initial = await owner.caller.mutation(create, request)
    const activeId = await activate(t, initial)
    const edit = await owner.caller.mutation(create, request)
    expect(edit.mode).toBe('edit')
    const advanced = await t.run(async (ctx) => {
      const active = await readCharacterRow(ctx, request.id)
      if (!active) throw new Error('Missing active fixture.')
      const updatedAt = new Date(Date.parse(active.updatedAt) + 1000).toISOString()
      const encoded = encodeCharacterRecord(active, {
        document: {
          ...edit.payload.character,
          status: 'ACTIVE' as const,
          state: {
            ...edit.payload.character.state,
            hitpoints: { ...edit.payload.character.state.hitpoints, current: 7 }
          }
        },
        streamVersion: 2,
        updatedAt
      })
      // The structure clock lives on the build record.
      await writeCharacterOperationalStructure(ctx, active, { ...encoded, updatedAt })
      await ctx.db.patch(active.play._id, {
        state: encoded.play.state,
        checksum: encoded.play.checksum,
        streamVersion: encoded.play.streamVersion,
        updatedAt: encoded.play.updatedAt
      })
      return { head: (await ctx.db.get(activeId))!, updatedAt }
    })
    const saved = await owner.caller.mutation(save, {
      characterId: request.id,
      character: { ...edit.payload.character, label: 'Uncommitted edit' },
      expectedDraftId: edit.id,
      mode: 'edit'
    })
    expect(saved.baseActiveUpdatedAt).toBe(edit.baseActiveUpdatedAt)
    await expect(
      owner.caller.mutation(save, {
        characterId: request.id,
        character: edit.payload.character,
        expectedDraftId: edit.id,
        mode: 'edit',
        baseActiveUpdatedAt: advanced.updatedAt
      })
    ).rejects.toThrow('base revision does not match')
    expect(await t.run((ctx) => ctx.db.get(activeId))).toEqual(advanced.head)
    await owner.caller.mutation(discard, { id: edit.publicId, expectedDraftId: edit.id })
    expect(await t.run((ctx) => ctx.db.get(activeId))).toEqual(advanced.head)
    const reopened = await owner.caller.mutation(create, request)
    expect(reopened.baseActiveUpdatedAt).toBe(advanced.updatedAt)
    expect(reopened.payload.character.state.hitpoints.current).toBe(7)
  })

  it('fails closed on corrupted payload identity and checksum', async () => {
    const { t, owner, other } = await fixture()
    const draft = await owner.caller.mutation(create, input())
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', draft.characterId))
        .unique()
      if (!stored) throw new Error('Missing draft fixture.')
      const payload = await ctx.db
        .query('characterDraftPayloads')
        .withIndex('by_characterId_id', (q) =>
          q.eq('characterId', stored.characterId).eq('id', stored.payloadId)
        )
        .unique()
      if (!payload) throw new Error('Missing draft payload fixture.')
      const corrupted = {
        ...draft.payload,
        character: { ...draft.payload.character, userId: other.userId }
      }
      const chunks = await ctx.db
        .query('characterDraftPayloadChunks')
        .withIndex('by_characterId_payloadId_chunkIndex', (q) =>
          q.eq('characterId', stored.characterId).eq('payloadId', payload.id)
        )
        .collect()
      for (const chunk of chunks) await ctx.db.delete(chunk._id)
      await ctx.db.patch(payload._id, {
        payloadJson: canonicalizeRuleDocument(corrupted),
        chunkCount: undefined,
        totalByteLength: undefined
      })
    })
    await expect(owner.caller.query(get, { id: draft.characterId })).rejects.toThrow(
      'checksum mismatch'
    )
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', draft.characterId))
        .unique()
      if (!stored) throw new Error('Missing payload-backed draft fixture.')
      const payload = await ctx.db
        .query('characterDraftPayloads')
        .withIndex('by_characterId_id', (q) =>
          q.eq('characterId', stored.characterId).eq('id', stored.payloadId)
        )
        .unique()
      if (!payload?.payloadJson) throw new Error('Missing inline draft payload fixture.')
      const checksum = checksumRuleDocument(JSON.parse(payload.payloadJson))
      await ctx.db.patch(payload._id, { checksum })
      await ctx.db.patch(stored._id, { checksum })
    })
    await expect(owner.caller.query(get, { id: draft.characterId })).rejects.toThrow(
      'identity mismatch'
    )
    expect(await other.caller.query(get, { id: draft.characterId })).toBeNull()
  })

  it('rolls back discard when a draft head names another draft payload', async () => {
    const { t, owner } = await fixture()
    const draft = await owner.caller.mutation(create, input())
    const other = await owner.caller.mutation(create, input())
    const snapshot = () =>
      t.run(async (ctx) => ({
        drafts: await ctx.db.query('characterDrafts').collect(),
        payloads: await ctx.db.query('characterDraftPayloads').collect(),
        chunks: await ctx.db.query('characterDraftPayloadChunks').collect()
      }))
    await t.run(async (ctx) => {
      const [stored, foreign] = await Promise.all(
        [draft, other].map((row) =>
          ctx.db
            .query('characterDrafts')
            .withIndex('by_characterId', (query) => query.eq('characterId', row.characterId))
            .unique()
        )
      )
      if (!stored || !foreign) throw new Error('Missing draft fixtures.')
      await ctx.db.patch(stored._id, { payloadDocumentId: foreign.payloadDocumentId })
    })
    const corrupted = await snapshot()

    await expect(
      owner.caller.mutation(discard, { id: draft.characterId, expectedDraftId: draft.id })
    ).rejects.toThrow('payload identity mismatch')
    expect(await snapshot()).toEqual(corrupted)
  }, 15_000)

  it('rolls back route allocation when draft validation fails after the route write', async () => {
    const { t, owner } = await fixture()
    const request = input()
    const before = await t.run((ctx) =>
      ctx.db
        .query('authoredRouteSequence')
        .withIndex('by_key', (q) => q.eq('key', 'authored'))
        .unique()
    )
    const random = vi.spyOn(crypto, 'randomUUID').mockReturnValue('not-a-valid-uuid-value')
    try {
      await expect(owner.caller.mutation(create, request)).rejects.toThrow()
    } finally {
      random.mockRestore()
    }
    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query('authoredRouteSequence')
          .withIndex('by_key', (q) => q.eq('key', 'authored'))
          .unique()
      ).toEqual(before)
      expect(
        await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', request.id))
          .unique()
      ).toBeNull()
      expect(
        await ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) => q.eq('characterId', request.id))
          .unique()
      ).toBeNull()
    })
  })
  it('keeps a job-tagged chunked payload unreachable until a draft head references it', async () => {
    const { t, owner } = await fixture()
    const request = input()
    const opened = await owner.caller.mutation(create, request)
    await owner.caller.mutation(discard, {
      id: request.id,
      expectedDraftId: opened.id
    })
    const importJobId = crypto.randomUUID()
    const staged = await t.run((ctx) =>
      insertCharacterDraftPayload(
        ctx,
        request.id,
        {
          ...opened.payload,
          character: {
            ...opened.payload.character,
            description: '🎲'.repeat(300_000)
          }
        },
        new Date().toISOString(),
        importJobId
      )
    )

    const stored = await t.run(async (ctx) => {
      const payload = await ctx.db
        .query('characterDraftPayloads')
        .withIndex('by_importJobId_id', (q) => q.eq('importJobId', importJobId))
        .unique()
      const chunkCount = payload?.chunkCount
      if (!chunkCount) throw new Error('Missing staged Character payload.')
      const chunks = await ctx.db
        .query('characterDraftPayloadChunks')
        .withIndex('by_characterId_payloadId_chunkIndex', (q) =>
          q.eq('characterId', request.id).eq('payloadId', payload.id)
        )
        .collect()
      const draft = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', request.id))
        .unique()
      const active = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', request.id))
        .unique()
      return { payload, chunkCount, chunks, draft, active }
    })

    expect(stored.payload).toMatchObject({
      id: staged.payloadId,
      characterId: request.id,
      importJobId
    })
    expect(stored.payload.chunkCount).toBeGreaterThan(1)
    expect(stored.chunks).toHaveLength(stored.chunkCount)
    expect(
      stored.chunks.every(
        (chunk, index) =>
          chunk.characterId === request.id &&
          chunk.payloadId === staged.payloadId &&
          chunk.chunkIndex === index
      )
    ).toBe(true)
    expect(stored.draft).toBeNull()
    expect(stored.active).toBeNull()
    expect(await owner.caller.query(get, { id: request.id })).toBeNull()
  })
  it('deletes inline and chunked payloads only for an exact stored head', async () => {
    const { t, owner } = await fixture()
    const request = input()
    const opened = await owner.caller.mutation(create, request)
    await owner.caller.mutation(discard, { id: request.id, expectedDraftId: opened.id })
    const inlinePayloadId = crypto.randomUUID()
    const inlinePayload = {
      ...opened.payload,
      character: { ...opened.payload.character, description: 'inline cleanup' }
    }
    const inlinePayloadJson = canonicalizeRuleDocument(inlinePayload)
    const createdAt = new Date().toISOString()
    const chunked = await t.run(async (ctx) => {
      await ctx.db.insert('characterDraftPayloads', {
        id: inlinePayloadId,
        characterId: request.id,
        payloadJson: inlinePayloadJson,
        checksum: checksumRuleDocument(inlinePayload),
        createdAt
      })
      return insertCharacterDraftPayload(
        ctx,
        request.id,
        {
          ...opened.payload,
          character: {
            ...opened.payload.character,
            description: '🎲'.repeat(300_000)
          }
        },
        createdAt
      )
    })

    await expect(
      t.run(async (ctx) => {
        const head = await ctx.db
          .query('characterDraftPayloads')
          .withIndex('by_characterId_id', (query) =>
            query.eq('characterId', request.id).eq('id', inlinePayloadId)
          )
          .unique()
        if (!head) throw new Error('Missing inline Character payload fixture.')
        await deleteCharacterDraftPayloadByHead(ctx, {
          ...head,
          characterId: crypto.randomUUID()
        })
      })
    ).rejects.toThrow('head identity mismatch')

    await t.run(async (ctx) => {
      for (const payloadId of [inlinePayloadId, chunked.payloadId]) {
        const head = await ctx.db
          .query('characterDraftPayloads')
          .withIndex('by_characterId_id', (query) =>
            query.eq('characterId', request.id).eq('id', payloadId)
          )
          .unique()
        if (!head) throw new Error('Missing Character payload cleanup fixture.')
        if (payloadId === inlinePayloadId) expect(head.chunkCount).toBeUndefined()
        else expect(head.chunkCount).toBeGreaterThan(1)
        await deleteCharacterDraftPayloadByHead(ctx, head)
      }
    })

    expect(
      await t.run(async (ctx) => ({
        inline: await ctx.db
          .query('characterDraftPayloads')
          .withIndex('by_characterId_id', (query) =>
            query.eq('characterId', request.id).eq('id', inlinePayloadId)
          )
          .unique(),
        chunked: await ctx.db
          .query('characterDraftPayloads')
          .withIndex('by_characterId_id', (query) =>
            query.eq('characterId', request.id).eq('id', chunked.payloadId)
          )
          .unique(),
        chunks: await ctx.db
          .query('characterDraftPayloadChunks')
          .withIndex('by_characterId_payloadId_chunkIndex', (query) =>
            query.eq('characterId', request.id).eq('payloadId', chunked.payloadId)
          )
          .collect()
      }))
    ).toEqual({ inline: null, chunked: null, chunks: [] })
  })
  it('replaces the payload in place, inline below 960 KB and chunked above it', async () => {
    const { t, owner } = await fixture()
    const request = input()
    const opened = await owner.caller.mutation(create, request)
    const read = () =>
      t.run(async (ctx) => {
        const draft = await ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) => q.eq('characterId', request.id))
          .unique()
        if (!draft) throw new Error('Missing Character draft.')
        return {
          draft,
          payloads: await ctx.db.query('characterDraftPayloads').collect(),
          chunks: await ctx.db.query('characterDraftPayloadChunks').collect()
        }
      })
    const saveDescription = (description: string) =>
      owner.caller.mutation(save, {
        characterId: request.id,
        character: { ...opened.payload.character, description },
        expectedDraftId: opened.id,
        mode: 'create'
      })
    const initial = await read()
    expect(initial.payloads).toHaveLength(1)
    expect(initial.payloads[0]!.payloadJson).toBeDefined()
    expect(initial.chunks).toEqual([])

    // 1.2 MB of UTF-8 falls back to chunks in the same payload document.
    const oversized = await saveDescription('🎲'.repeat(300_000))
    const chunked = await read()
    expect(chunked.draft.payloadDocumentId).toBe(initial.draft.payloadDocumentId)
    expect(chunked.payloads).toHaveLength(1)
    expect(chunked.payloads[0]!._id).toBe(initial.payloads[0]!._id)
    expect(chunked.payloads[0]!.payloadJson).toBeUndefined()
    expect(chunked.payloads[0]!.chunkCount).toBeGreaterThan(1)
    expect(chunked.chunks).toHaveLength(chunked.payloads[0]!.chunkCount!)
    expect(
      chunked.chunks.every(
        (chunk, index) => chunk.payloadId === chunked.draft.payloadId && chunk.chunkIndex === index
      )
    ).toBe(true)
    expect(await owner.caller.query(get, { id: request.id })).toEqual(oversized)

    // A small save goes back inline and deletes the old chunks.
    const small = await saveDescription('Back to one document')
    const inline = await read()
    expect(inline.payloads.map((payload) => payload._id)).toEqual([initial.payloads[0]!._id])
    expect(inline.payloads[0]!.payloadJson).toBeDefined()
    expect(inline.chunks).toEqual([])
    expect(await owner.caller.query(get, { id: request.id })).toEqual(small)

    // A missing chunk fails the read closed.
    await saveDescription('🎲'.repeat(300_000))
    const broken = await read()
    await t.run((ctx) => ctx.db.delete(broken.chunks[0]!._id))
    await expect(owner.caller.query(get, { id: request.id })).rejects.toThrow(
      'chunk count mismatch'
    )
  })
})
