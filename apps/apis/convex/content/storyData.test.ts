import { afterEach, expect, it, vi } from 'vitest'
import { publicationFixture } from '../../tests/fixtures/publication'
import { convexDevelopmentClient } from '../../tests/fixtures/convexDevelopmentClient'
import { seedStoryData } from '../../tests/developmentReviewData'
import { REVIEW_STORY_READER, STORY_RECORDS } from '../../tests/developmentReviewDataScenarios'
import { api, internal } from '../_generated/api'

afterEach(() => {
  vi.useRealTimers()
})

// Storybook backend stories open these records by id and expect each in its authoring state (D221).
it('gives the story account an active copy and a copy with a waiting draft per domain, once', async () => {
  // Full-corpus work must not expire the fixture's auth session.
  vi.useFakeTimers({ toFake: ['Date'] })
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    []
  )
  await t.action(internal.content.seed.seed, {})
  const reader = convexDevelopmentClient(first.caller)
  const accounts: string[] = []
  const connect = async (spec: { key: string }) => {
    accounts.push(spec.key)
    return reader
  }
  const stored = () =>
    t.run(async (ctx) => ({
      roots: (
        await ctx.db
          .query('authoredRoots')
          .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', first.userId))
          .collect()
      )
        .map((root) => `${root.subjectKind} ${root.label}`)
        .sort(),
      drafts: (
        await ctx.db
          .query('authoredDrafts')
          .withIndex('by_userId', (q) => q.eq('userId', first.userId))
          .collect()
      )
        .map((draft) => `${draft.subjectKind} ${draft.label} ${draft.draftState}`)
        .sort()
    }))

  await seedStoryData(connect)
  const seeded = await stored()
  await seedStoryData(connect)

  expect(accounts).toEqual([REVIEW_STORY_READER.key, REVIEW_STORY_READER.key])
  const records = Object.values(STORY_RECORDS)
  expect(seeded).toEqual({
    roots: records
      .flatMap(({ subjectKind, ownedActive, ownedDraft }) => [
        `${subjectKind} ${ownedActive.label}`,
        `${subjectKind} ${ownedDraft.label}`
      ])
      .sort(),
    drafts: records
      .map(({ subjectKind, ownedDraft }) => `${subjectKind} ${ownedDraft.label} ACTIVE_WITH_DRAFT`)
      .sort()
  })
  for (const { subjectKind, ownedActive, ownedDraft } of records) {
    for (const record of [ownedActive, ownedDraft]) {
      const read = await reader.query(api.content.details.get, {
        subjectKind,
        id: record.subjectId
      })
      expect(read?.item).toMatchObject({ id: record.subjectId, label: record.label })
    }
  }
  expect(await stored()).toEqual(seeded)
}, 240_000)
