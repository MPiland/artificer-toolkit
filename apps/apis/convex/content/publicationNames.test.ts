import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import {
  authoredPublicationNameBackfillInputSchema,
  authoredDeleteActiveInputSchema,
  authoredPublishDraftInputSchema,
  type AuthoredPublicationNameBackfillInput,
  type AuthoredPublicationNameBackfillResult,
  type AuthoredDeleteActiveInput,
  type AuthoredPublishDraftInput,
  type AuthoredPublicationResult
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { api } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'

const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const backfill = makeFunctionReference<
  'mutation',
  AuthoredPublicationNameBackfillInput,
  AuthoredPublicationNameBackfillResult
>('content/publicationNames:backfill')
const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [[importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte })]]
  )
}

async function copyDraft(caller: Awaited<ReturnType<typeof fixture>>['first']['caller']) {
  return caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'BACKGROUND',
    subjectId: acolyte.id
  })
}

function publicationInput(draft: AuthoredDraftResult) {
  return authoredPublishDraftInputSchema.parse({
    subjectKind: 'BACKGROUND',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

async function renameDraft(
  caller: Awaited<ReturnType<typeof fixture>>['first']['caller'],
  draft: AuthoredDraftResult,
  label: string
) {
  return caller.mutation(api.content.drafts.save, {
    subjectKind: 'BACKGROUND',
    subjectId: draft.subjectId,
    systemId: draft.systemId,
    label,
    payload: draft.payload
  })
}

describe('native active publication names', () => {
  it('allows duplicate drafts but rejects a normalized active-name conflict without consuming it', async () => {
    const { t, first } = await fixture()
    const firstDraft = await renameDraft(
      first.caller,
      await copyDraft(first.caller),
      '  Shared Name  '
    )
    const conflictingDraft = await renameDraft(
      first.caller,
      await copyDraft(first.caller),
      'shared name'
    )

    await first.caller.mutation(publish, publicationInput(firstDraft))
    await expect(
      first.caller.mutation(publish, publicationInput(conflictingDraft))
    ).rejects.toThrow('ACTIVE_NAME_CONFLICT')
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'BACKGROUND',
        subjectId: conflictingDraft.subjectId
      })
    ).toEqual(conflictingDraft)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', conflictingDraft.subjectId))
          .unique()
      )
    ).toBeNull()
  })

  it('scopes active names to each owner and fails closed until an owned partition is backfilled', async () => {
    const { t, first, second } = await fixture()
    const firstDraft = await renameDraft(first.caller, await copyDraft(first.caller), 'Shared name')
    const secondDraft = await renameDraft(
      second.caller,
      await copyDraft(second.caller),
      ' shared NAME '
    )
    await first.caller.mutation(publish, publicationInput(firstDraft))
    await second.caller.mutation(publish, publicationInput(secondDraft))

    const blockedDraft = await renameDraft(
      first.caller,
      await copyDraft(first.caller),
      'Another name'
    )
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', firstDraft.subjectId))
        .unique()
      if (!root) throw new Error('Missing owned publication')
      await ctx.db.patch(root._id, { activeNameKey: undefined })
    })
    await expect(first.caller.mutation(publish, publicationInput(blockedDraft))).rejects.toThrow(
      'ACTIVE_NAME_INDEX_INCOMPLETE'
    )
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'BACKGROUND',
        subjectId: blockedDraft.subjectId
      })
    ).toEqual(blockedDraft)
  })

  it('permits an unchanged self edit, rejects a conflicting rename, and releases a deleted name', async () => {
    const { first } = await fixture()
    const firstDraft = await renameDraft(first.caller, await copyDraft(first.caller), 'First name')
    await first.caller.mutation(publish, publicationInput(firstDraft))
    const unchanged = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: firstDraft.subjectId,
      systemId: firstDraft.systemId,
      label: ' first NAME ',
      payload: firstDraft.payload
    })
    await first.caller.mutation(publish, publicationInput(unchanged))
    const secondDraft = await renameDraft(
      first.caller,
      await copyDraft(first.caller),
      'Second name'
    )
    await first.caller.mutation(publish, publicationInput(secondDraft))
    const conflictingRename = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: firstDraft.subjectId,
      systemId: firstDraft.systemId,
      label: 'second NAME',
      payload: firstDraft.payload
    })
    await expect(
      first.caller.mutation(publish, publicationInput(conflictingRename))
    ).rejects.toThrow('ACTIVE_NAME_CONFLICT')
    await first.caller.mutation(
      deleteActive,
      authoredDeleteActiveInputSchema.parse({
        subjectKind: 'BACKGROUND',
        subjectId: secondDraft.subjectId
      })
    )
    const released = await renameDraft(first.caller, await copyDraft(first.caller), ' second name ')
    await expect(first.caller.mutation(publish, publicationInput(released))).resolves.toBeDefined()
  })

  it('allows the sole unindexed active root to repair itself through publication', async () => {
    const { t, first } = await fixture()
    const draft = await renameDraft(first.caller, await copyDraft(first.caller), 'Recoverable name')
    await first.caller.mutation(publish, publicationInput(draft))
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
        .unique()
      if (!root) throw new Error('Missing owned publication')
      await ctx.db.patch(root._id, { activeNameKey: undefined })
    })
    const edit = await renameDraft(first.caller, draft, ' recoverable NAME ')
    await first.caller.mutation(publish, publicationInput(edit))
    expect(
      await t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
          .unique()
        return root?.activeNameKey
      })
    ).toBe('recoverable name')
  })

  it('backfills only missing exact keys in bounded, idempotent owner partitions', async () => {
    const { t, first } = await fixture()
    const firstDraft = await renameDraft(first.caller, await copyDraft(first.caller), 'First name')
    const secondDraft = await renameDraft(
      first.caller,
      await copyDraft(first.caller),
      'Second name'
    )
    const thirdDraft = await renameDraft(first.caller, await copyDraft(first.caller), 'Third name')
    await first.caller.mutation(publish, publicationInput(firstDraft))
    await first.caller.mutation(publish, publicationInput(secondDraft))
    await first.caller.mutation(publish, publicationInput(thirdDraft))
    await t.run(async (ctx) => {
      for (const subjectId of [firstDraft.subjectId, secondDraft.subjectId, thirdDraft.subjectId]) {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', subjectId))
          .unique()
        if (!root) throw new Error('Missing owned publication')
        await ctx.db.patch(root._id, { activeNameKey: undefined })
      }
    })
    const subjectIds = [firstDraft.subjectId, secondDraft.subjectId, thirdDraft.subjectId]
    const rootsBeforeBackfill = await t.run((ctx) =>
      Promise.all(
        subjectIds.map((subjectId) =>
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', subjectId))
            .unique()
        )
      )
    )
    if (rootsBeforeBackfill.some((root) => !root)) throw new Error('Missing owned publication')
    const expectedKeys = ['first name', 'second name', 'third name']
    const expectedRoots = rootsBeforeBackfill.map((root, index) => ({
      ...root!,
      activeNameKey: expectedKeys[index]
    }))
    const input = authoredPublicationNameBackfillInputSchema.parse({
      ownerUserId: first.userId,
      systemId: acolyte.systemId,
      subjectKind: 'BACKGROUND',
      cursor: null
    })
    const firstPass = await t.mutation(backfill, input)
    expect(firstPass).toEqual({
      processed: 2,
      continueCursor: expect.any(String),
      isDone: false
    })
    const secondPass = await t.mutation(backfill, {
      ...input,
      cursor: firstPass.continueCursor
    })
    expect(secondPass).toMatchObject({ processed: 1, isDone: true })
    const keys = await t.run(async (ctx) =>
      Promise.all(
        subjectIds.map(async (subjectId) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', subjectId))
            .unique()
          return root?.activeNameKey
        })
      )
    )
    expect(keys).toEqual(['first name', 'second name', 'third name'])
    const readRoots = () =>
      t.run((ctx) =>
        Promise.all(
          subjectIds.map((subjectId) =>
            ctx.db
              .query('authoredRoots')
              .withIndex('by_publicId', (q) => q.eq('id', subjectId))
              .unique()
          )
        )
      )
    expect(await readRoots()).toEqual(expectedRoots)
    const replayFirst = await t.mutation(backfill, input)
    expect(replayFirst).toEqual(firstPass)
    expect(await t.mutation(backfill, { ...input, cursor: replayFirst.continueCursor })).toEqual(
      secondPass
    )
    expect(await readRoots()).toEqual(expectedRoots)

    await t.run(async (ctx) => {
      const roots = await Promise.all(
        [firstDraft.subjectId, secondDraft.subjectId].map((subjectId) =>
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', subjectId))
            .unique()
        )
      )
      if (roots.some((root) => !root)) throw new Error('Missing owned publication')
      await ctx.db.patch(roots[0]!._id, { activeNameKey: undefined })
      await ctx.db.patch(roots[1]!._id, { activeNameKey: 'wrong key' })
    })
    await expect(t.mutation(backfill, input)).rejects.toThrow('Active name backfill key mismatch.')
    expect(
      await t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', firstDraft.subjectId))
          .unique()
        return root?.activeNameKey
      })
    ).toBeNull()
  })
})
