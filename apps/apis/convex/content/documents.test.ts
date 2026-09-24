import { describe, expect, it } from 'vitest'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import {
  AUTHORED_CHUNKED_PAYLOAD_MARKER,
  AUTHORED_PAYLOAD_CHUNK_MAX_BYTES,
  authoredStoredDraftPayloadHeadSchema
} from '@artificer-toolkit/schema/api/authoredDrafts'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { api } from '../_generated/api'
import {
  canReadAuthoredRoot,
  deleteAuthoredVersion,
  deleteDraftPayloadByHead,
  insertAuthoredVersion,
  insertDraftPayload,
  parsePublishedDocument,
  readDraft,
  readAuthoredVersion,
  readPublishedDocument
} from './documents'
import { ensureAuthoredRouteId, readVisibleAuthoredRouteId } from './routeIds'

it('preserves source identity and ownership checks when reusing a transaction-local source', async () => {
  const { t, first, second } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({
          subjectKind: 'EQUIPMENT',
          ...backpack,
          document: backpack
        })
      ]
    ]
  )
  await t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', backpack.id))
      .unique()
    if (!root) throw new Error('Missing Equipment fixture.')
    const source = await ctx.db
      .query('contentSources')
      .withIndex('by_publicId', (q) => q.eq('id', root.contentSourceId))
      .unique()
    if (!source) throw new Error('Missing source fixture.')
    for (const [rootOwner, sourcePatch, reader, allowed] of [
      [undefined, { kind: 'PLATFORM', ownerUserId: null }, null, true],
      [undefined, { kind: 'PLATFORM', ownerUserId: null }, first.userId, true],
      [first.userId, { kind: 'PLATFORM', ownerUserId: null }, first.userId, false],
      [first.userId, { kind: 'USER', ownerUserId: first.userId }, first.userId, true],
      [first.userId, { kind: 'USER', ownerUserId: first.userId }, second.userId, false],
      [undefined, { kind: 'USER', ownerUserId: first.userId }, first.userId, false],
      [first.userId, { kind: 'USER', ownerUserId: second.userId }, first.userId, false],
      [first.userId, { kind: 'USER', ownerUserId: first.userId }, null, false]
    ] as const) {
      await ctx.db.patch(source._id, sourcePatch)
      const currentSource = await ctx.db.get(source._id)
      if (!currentSource) throw new Error('Missing current source fixture.')
      const currentRoot = { ...root, ownerUserId: rootOwner }
      expect(await canReadAuthoredRoot(ctx, currentRoot, reader)).toBe(allowed)
      expect(await canReadAuthoredRoot(ctx, currentRoot, reader, currentSource)).toBe(allowed)
    }
    expect(
      await canReadAuthoredRoot(ctx, root, null, {
        ...source,
        id: crypto.randomUUID()
      })
    ).toBe(false)
    expect(
      await canReadAuthoredRoot(ctx, root, null, {
        ...source,
        gameSystemId: crypto.randomUUID()
      })
    ).toBe(false)
  })
}, 10_000)
it('hides imported authored rows until the job completes', async () => {
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({
          subjectKind: 'EQUIPMENT',
          ...backpack,
          document: backpack
        })
      ]
    ]
  )
  await t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (query) => query.eq('id', backpack.id))
      .unique()
    if (!root) throw new Error('Missing Equipment fixture.')
    const version = await ctx.db.get(root.currentVersionId)
    if (!version) throw new Error('Missing Equipment version fixture.')
    const jobId = crypto.randomUUID()
    const previewId = crypto.randomUUID()
    const now = new Date().toISOString()
    const jobRowId = await ctx.db.insert('importJobs', {
      id: jobId,
      ownerUserId: first.userId,
      previewId,
      command: {
        commandId: crypto.randomUUID(),
        previewId,
        selectedEntryIds: [root.id],
        resolutions: [],
        customContentChoices: []
      },
      inputFingerprint: '0'.repeat(64),
      source: 'ARTIFICER_JSON',
      status: 'RUNNING',
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
    const stagedDraftRowId = await ctx.db.insert('authoredDrafts', {
      subjectKind: 'EQUIPMENT',
      subjectId: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      userId: first.userId,
      systemId: root.systemId,
      label: 'Staged Equipment draft',
      status: 'DRAFT',
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null,
      basePublishedChecksum: null,
      payloadJson: canonicalizeRuleDocument({ notes: 'staged' }),
      importJobId: jobId
    })
    const route = await ctx.db
      .query('authoredRouteIds')
      .withIndex('by_subjectId', (query) => query.eq('subjectId', root.id))
      .unique()
    if (!route) throw new Error('Missing Equipment route fixture.')
    await ctx.db.patch(root._id, { importJobId: jobId })
    await ctx.db.patch(version._id, { importJobId: jobId })
    await ctx.db.patch(route._id, { importJobId: jobId })

    expect(await readVisibleAuthoredRouteId(ctx, { subjectId: root.id })).toBeNull()
    expect(await readVisibleAuthoredRouteId(ctx, { publicId: route.publicId })).toBeNull()
    expect(
      await ensureAuthoredRouteId(ctx, root.subjectKind, root.id, false, undefined, jobId)
    ).toBe(route.publicId)
    await expect(ensureAuthoredRouteId(ctx, root.subjectKind, root.id)).rejects.toThrow(
      'Authored route identity conflict.'
    )
    await expect(
      ensureAuthoredRouteId(ctx, root.subjectKind, root.id, false, undefined, crypto.randomUUID())
    ).rejects.toThrow('Authored route identity conflict.')

    const hiddenRoot = await ctx.db.get(root._id)
    const stagedDraft = await ctx.db.get(stagedDraftRowId)
    if (!hiddenRoot) throw new Error('Missing staged root fixture.')
    if (!stagedDraft) throw new Error('Missing staged draft fixture.')
    expect(await canReadAuthoredRoot(ctx, hiddenRoot, null)).toBe(false)
    expect(await canReadAuthoredRoot(ctx, hiddenRoot, null, undefined, jobId)).toBe(true)
    await expect(readDraft(ctx, stagedDraft)).rejects.toThrow('unavailable')
    expect(await readDraft(ctx, stagedDraft, jobId)).toMatchObject({
      subjectId: stagedDraft.subjectId,
      payload: { notes: 'staged' }
    })
    await expect(readDraft(ctx, stagedDraft, crypto.randomUUID())).rejects.toThrow('unavailable')
    await expect(readAuthoredVersion(ctx, hiddenRoot)).rejects.toThrow('identity mismatch')
    expect(await readAuthoredVersion(ctx, hiddenRoot, jobId)).toMatchObject({
      versionId: version.versionId
    })
    await expect(readAuthoredVersion(ctx, hiddenRoot, crypto.randomUUID())).rejects.toThrow(
      'identity mismatch'
    )

    await ctx.db.patch(jobRowId, { status: 'COMPLETED' })
    expect(await readVisibleAuthoredRouteId(ctx, { subjectId: root.id })).toMatchObject({
      publicId: route.publicId
    })
    const visibleRoot = await ctx.db.get(root._id)
    if (!visibleRoot) throw new Error('Missing completed root fixture.')
    expect(await canReadAuthoredRoot(ctx, visibleRoot, null)).toBe(true)
    expect(await readAuthoredVersion(ctx, visibleRoot)).toMatchObject({
      versionId: version.versionId
    })
  })
}, 10_000)

describe('published document JSON fast path parity', () => {
  it('matches normalized JSON values, including prototype and Unicode escape keys', async () => {
    const { t } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [
        [
          importedSubject({
            subjectKind: 'EQUIPMENT',
            ...backpack,
            document: backpack
          })
        ]
      ]
    )
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', backpack.id))
        .unique()
      if (!root) throw new Error('Missing Equipment fixture.')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing Equipment version fixture.')
      const cases = [
        JSON.stringify(backpack),
        `${JSON.stringify(backpack).slice(0, -1)},"nested":[-0,1e-4,9007199254740993],"constructor":{"ok":true}}`,
        `${JSON.stringify(backpack).slice(0, -1)},"__proto__":{"polluted":true},"nested":[{"\\u005f\\u005fproto__":{"x":1}}]}`,
        `${JSON.stringify(backpack).slice(0, -1)},"\\u005f_pro\\u0074o__":{"x":1},"nested":{"\\u005F\\u005Fproto__":{"y":2}}}`,
        `${JSON.stringify(backpack).slice(0, -1)},"__proto__":{"discarded":1e400}}`,
        `${JSON.stringify(backpack).slice(0, -1)},"nested":[{"2":"two","10":"ten","01":"leading","z":null,"a":true}]}`,
        `${JSON.stringify(backpack).slice(0, -1)},"nested":{"é":"line\\nfeed","😀":{"z":false,"a":-0},"a":[null,{},[]]}}`,
        `${JSON.stringify(backpack).slice(0, -1)},"duplicate":1,"duplicate":2}`
      ]
      for (const documentJson of cases) {
        const expected = jsonValueSchema.parse(JSON.parse(documentJson))
        const candidateRoot = {
          ...root,
          checksum: checksumRuleDocument(expected)
        }
        for (const json of [documentJson, canonicalizeRuleDocument(expected)]) {
          expect(
            parsePublishedDocument(
              candidateRoot,
              {
                ...version,
                checksum: candidateRoot.checksum,
                documentJson: json
              },
              json
            )
          ).toEqual(jsonValueSchema.parse(JSON.parse(json)))
        }
      }
    })
  })

  it('rejects malformed, non-finite, corrupt, and mismatched published documents', async () => {
    const { t } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [
        [
          importedSubject({
            subjectKind: 'EQUIPMENT',
            ...backpack,
            document: backpack
          })
        ]
      ]
    )
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', backpack.id))
        .unique()
      if (!root) throw new Error('Missing Equipment fixture.')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing Equipment version fixture.')
      expect(() => parsePublishedDocument(root, { ...version, documentJson: '{' }, '{')).toThrow()
      expect(() =>
        parsePublishedDocument(
          root,
          { ...version, documentJson: '{"nested":1e400}' },
          '{"nested":1e400}'
        )
      ).toThrow()
      expect(() =>
        parsePublishedDocument(
          root,
          { ...version, documentJson: '{"nested":[{"a":-1e400}]}' },
          '{"nested":[{"a":-1e400}]}'
        )
      ).toThrow('finite numbers')
      const corruptJson = canonicalizeRuleDocument({
        ...backpack,
        description: 'corrupt'
      })
      expect(() =>
        parsePublishedDocument(root, { ...version, documentJson: corruptJson }, corruptJson)
      ).toThrow('checksum mismatch')
      for (const field of ['id', 'kind', 'systemId', 'label'] as const) {
        const document = { ...backpack, [field]: crypto.randomUUID() }
        const checksum = checksumRuleDocument(document)
        const documentJson = canonicalizeRuleDocument(document)
        expect(() =>
          parsePublishedDocument(
            { ...root, checksum },
            { ...version, checksum, documentJson },
            documentJson
          )
        ).toThrow('metadata mismatch')
      }
      const documentJson = canonicalizeRuleDocument(backpack)
      expect(() =>
        parsePublishedDocument(
          { ...root, ownerUserId: crypto.randomUUID() },
          { ...version, documentJson },
          documentJson
        )
      ).toThrow('metadata mismatch')
    })
  })
})

describe('authored chunk persistence', () => {
  it('deletes inline and chunked payloads only for an exact stored head', async () => {
    const { t } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [
        [
          importedSubject({
            subjectKind: 'EQUIPMENT',
            ...backpack,
            document: backpack
          })
        ]
      ]
    )
    const inlineSubjectId = crypto.randomUUID()
    const inlinePayloadId = crypto.randomUUID()
    const inlinePayload = { notes: 'inline' }
    const chunkedSubjectId = crypto.randomUUID()
    const chunkedPayloadId = await t.run(async (ctx) => {
      await ctx.db.insert('authoredDraftPayloads', {
        id: inlinePayloadId,
        subjectId: inlineSubjectId,
        payloadJson: canonicalizeRuleDocument(inlinePayload),
        checksum: checksumRuleDocument(inlinePayload)
      })
      return insertDraftPayload(
        ctx,
        chunkedSubjectId,
        backpack.systemId,
        canonicalizeRuleDocument({ notes: '🎲'.repeat(70_000) })
      )
    })

    await expect(
      t.run(async (ctx) => {
        const head = await ctx.db
          .query('authoredDraftPayloads')
          .withIndex('by_publicId', (query) => query.eq('id', inlinePayloadId))
          .unique()
        if (!head) throw new Error('Missing inline authored payload fixture.')
        await deleteDraftPayloadByHead(ctx, { ...head, subjectId: crypto.randomUUID() })
      })
    ).rejects.toThrow('head identity mismatch')

    await t.run(async (ctx) => {
      for (const payloadId of [inlinePayloadId, chunkedPayloadId]) {
        const head = await ctx.db
          .query('authoredDraftPayloads')
          .withIndex('by_publicId', (query) => query.eq('id', payloadId))
          .unique()
        if (!head) throw new Error('Missing authored payload cleanup fixture.')
        if (payloadId === inlinePayloadId) expect(head.chunkCount).toBeUndefined()
        else expect(head.chunkCount).toBeGreaterThan(1)
        await deleteDraftPayloadByHead(ctx, head)
      }
    })

    expect(
      await t.run(async (ctx) => ({
        inline: await ctx.db
          .query('authoredDraftPayloads')
          .withIndex('by_publicId', (query) => query.eq('id', inlinePayloadId))
          .unique(),
        chunked: await ctx.db
          .query('authoredDraftPayloads')
          .withIndex('by_publicId', (query) => query.eq('id', chunkedPayloadId))
          .unique(),
        chunks: await ctx.db
          .query('authoredDraftPayloadChunks')
          .withIndex('by_subjectId_payloadId_chunkIndex', (query) =>
            query.eq('subjectId', chunkedSubjectId).eq('payloadId', chunkedPayloadId)
          )
          .collect()
      }))
    ).toEqual({ inline: null, chunked: null, chunks: [] })
  })
  it('stages a multibyte payload by import job without creating a visible draft', async () => {
    const { t } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [
        [
          importedSubject({
            subjectKind: 'EQUIPMENT',
            ...backpack,
            document: backpack
          })
        ]
      ]
    )
    const subjectId = crypto.randomUUID()
    const importJobId = crypto.randomUUID()
    const payloadJson = canonicalizeRuleDocument({
      notes: '🎲'.repeat(280_000)
    })
    const payloadId = await t.run((ctx) =>
      insertDraftPayload(ctx, subjectId, backpack.systemId, payloadJson, importJobId)
    )
    const staged = await t.run(async (ctx) => ({
      payloads: await ctx.db
        .query('authoredDraftPayloads')
        .withIndex('by_importJobId_id', (query) => query.eq('importJobId', importJobId))
        .take(2),
      chunks: await ctx.db
        .query('authoredDraftPayloadChunks')
        .withIndex('by_subjectId_payloadId_chunkIndex', (query) =>
          query.eq('subjectId', subjectId).eq('payloadId', payloadId)
        )
        .take(100),
      draft: await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (query) => query.eq('subjectId', subjectId))
        .unique()
    }))
    expect(staged.payloads).toHaveLength(1)
    expect(staged.payloads[0]).toMatchObject({
      id: payloadId,
      subjectId,
      importJobId,
      payloadJson: AUTHORED_CHUNKED_PAYLOAD_MARKER
    })
    expect(staged.chunks.length).toBeGreaterThan(4)
    expect(staged.draft).toBeNull()
    const { _id, _creationTime, ...stored } = staged.payloads[0]!
    expect(
      authoredStoredDraftPayloadHeadSchema.safeParse({
        ...stored,
        importJobId: 'invalid'
      }).success
    ).toBe(false)
  })

  it('round-trips a multibyte draft above 1 MiB and rolls replacement back on corruption', async () => {
    const { t, first } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [
        [
          importedSubject({
            subjectKind: 'EQUIPMENT',
            ...backpack,
            document: backpack
          })
        ]
      ]
    )
    const subjectId = crypto.randomUUID()
    const notes = '🧙'.repeat(280_000)
    await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId,
      systemId: backpack.systemId,
      label: 'Large multibyte draft',
      payload: { notes }
    })
    const stored = await t.run((ctx) =>
      ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (query) => query.eq('subjectId', subjectId))
        .unique()
    )
    if (!stored || !('payloadId' in stored)) throw new Error('Missing chunked draft fixture.')
    const roundTrip = await t.run((ctx) => readDraft(ctx, stored))
    expect(roundTrip.payload.notes).toBe(notes)
    const payload = await t.run((ctx) =>
      ctx.db
        .query('authoredDraftPayloads')
        .withIndex('by_publicId', (query) => query.eq('id', stored.payloadId))
        .unique()
    )
    expect(payload?.payloadJson).toBe(AUTHORED_CHUNKED_PAYLOAD_MARKER)
    expect(payload?.chunkCount).toBeGreaterThan(4)
    const chunks = await t.run((ctx) =>
      ctx.db
        .query('authoredDraftPayloadChunks')
        .withIndex('by_subjectId_payloadId_chunkIndex', (query) =>
          query.eq('subjectId', subjectId).eq('payloadId', stored.payloadId)
        )
        .take(100)
    )
    expect(
      chunks.every((chunk) => chunk.bytes.byteLength <= AUTHORED_PAYLOAD_CHUNK_MAX_BYTES)
    ).toBe(true)
    await t.run((ctx) => ctx.db.delete(chunks[Math.floor(chunks.length / 2)]!._id))
    const snapshot = () =>
      t.run(async (ctx) => ({
        draft: await ctx.db
          .query('authoredDrafts')
          .withIndex('by_subjectId', (query) => query.eq('subjectId', subjectId))
          .unique(),
        payloads: await ctx.db.query('authoredDraftPayloads').take(10),
        chunks: await ctx.db
          .query('authoredDraftPayloadChunks')
          .withIndex('by_subjectId_payloadId_chunkIndex', (query) =>
            query.eq('subjectId', subjectId)
          )
          .take(100)
      }))
    const before = await snapshot()
    await expect(
      first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'BACKGROUND',
        subjectId,
        systemId: backpack.systemId,
        label: 'Replacement must roll back',
        payload: { notes: 'replacement' }
      })
    ).rejects.toThrow('chunks are incomplete')
    expect(await snapshot()).toEqual(before)
  })

  it('round-trips a multibyte published version above 1 MiB and preserves corrupt storage', async () => {
    const { t } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [
        [
          importedSubject({
            subjectKind: 'EQUIPMENT',
            ...backpack,
            document: backpack
          })
        ]
      ]
    )
    const subjectId = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    const importJobId = crypto.randomUUID()
    const notes = '🎲'.repeat(280_000)
    const document = jsonValueSchema.parse({
      id: subjectId,
      kind: 'EQUIPMENT',
      systemId: backpack.systemId,
      label: 'Large persisted document',
      status: 'ACTIVE',
      notes
    })
    const documentJson = canonicalizeRuleDocument(document)
    const checksum = checksumRuleDocument(document)
    const storedIds = await t.run(async (ctx) => {
      const sourceRoot = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (query) => query.eq('id', backpack.id))
        .unique()
      if (!sourceRoot) throw new Error('Missing source fixture.')
      const currentVersionId = await insertAuthoredVersion(
        ctx,
        {
          subjectKind: 'EQUIPMENT',
          id: subjectId,
          systemId: backpack.systemId,
          label: 'Large persisted document',
          checksum,
          contentSourceId: sourceRoot.contentSourceId,
          importJobId,
          versionId,
          version: 1,
          documentSchemaVersion: 1
        },
        documentJson
      )
      const rootId = await ctx.db.insert('authoredRoots', {
        id: subjectId,
        subjectKind: 'EQUIPMENT',
        systemId: backpack.systemId,
        label: 'Large persisted document',
        checksum,
        contentSourceId: sourceRoot.contentSourceId,
        currentVersionId
      })
      return { currentVersionId, rootId }
    })
    const roundTrip = await t.run(async (ctx) => {
      const root = await ctx.db.get(storedIds.rootId)
      const version = await ctx.db.get(storedIds.currentVersionId)
      if (!root || !version) throw new Error('Missing published chunk fixture.')
      expect(version.importJobId).toBe(importJobId)
      return readPublishedDocument(ctx, root, version)
    })
    expect(roundTrip.notes).toBe(notes)
    const chunks = await t.run((ctx) =>
      ctx.db
        .query('authoredVersionPayloadChunks')
        .withIndex('by_versionId_chunkIndex', (query) => query.eq('versionId', versionId))
        .take(100)
    )
    expect(chunks.length).toBeGreaterThan(4)
    await t.run((ctx) => ctx.db.delete(chunks[Math.floor(chunks.length / 2)]!._id))
    const snapshot = () =>
      t.run(async (ctx) => ({
        version: await ctx.db.get(storedIds.currentVersionId),
        chunks: await ctx.db
          .query('authoredVersionPayloadChunks')
          .withIndex('by_versionId_chunkIndex', (query) => query.eq('versionId', versionId))
          .take(100)
      }))
    const before = await snapshot()
    await expect(
      t.run(async (ctx) => {
        const version = await ctx.db.get(storedIds.currentVersionId)
        if (!version) throw new Error('Missing corrupt version fixture.')
        await deleteAuthoredVersion(ctx, version)
      })
    ).rejects.toThrow('chunks are incomplete')
    expect(await snapshot()).toEqual(before)
  })
})
