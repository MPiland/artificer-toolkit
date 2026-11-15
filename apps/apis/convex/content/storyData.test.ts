import { afterEach, expect, it, vi } from 'vitest'
import type { FunctionReturnType } from 'convex/server'
import { detectMagic } from '@artificer-toolkit/source-data/srd/spells/detect-magic.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { publicationFixture } from '../../tests/fixtures/publication'
import { convexDevelopmentClient } from '../../tests/fixtures/convexDevelopmentClient'
import { seedStoryData, type StoryClient } from '../../tests/developmentReviewData'
import type { ActionCtx } from '../_generated/server'
import {
  REVIEW_STORY_READER,
  STORY_CHARACTERS,
  STORY_RECORDS
} from '../../tests/developmentReviewDataScenarios'
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
  const reader: StoryClient = {
    ...convexDevelopmentClient(first.caller),
    action: (action, ...args) =>
      first.caller.action<(ctx: ActionCtx) => Promise<FunctionReturnType<typeof action>>>((ctx) =>
        ctx.runAction(action, ...args)
      )
  }
  const accounts: string[] = []
  const connect = async (spec: { key: string }) => {
    accounts.push(spec.key)
    return reader
  }
  const characters = Object.values(STORY_CHARACTERS)
  // Four copies per Character (race, background, class, equipment), a second class for the
  // multiclass Character and three spells for the caster.
  const characterCopyCount = characters.length * 4 + 1 + 3
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
      characters: (
        await ctx.db
          .query('characters')
          .withIndex('by_userId', (q) => q.eq('userId', first.userId))
          .collect()
      )
        .map((character) => `${character.id} ${character.label}`)
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

  const grantGmTier = async (userId: string) => {
    await t.mutation(internal.accountEntitlements.setTier, { userId, tier: 'GM' })
  }

  await seedStoryData(connect, grantGmTier)
  const seeded = await stored()
  await seedStoryData(connect, grantGmTier)

  expect(accounts).toEqual([REVIEW_STORY_READER.key, REVIEW_STORY_READER.key])
  const records = Object.values(STORY_RECORDS)
  // A story Character's Builder commit copies its race, background, class and equipment under
  // labels ending in its id, and the caster also owns copies of its three default spells.
  const isCharacterCopy = (root: string) =>
    characters.some(({ characterId }) => root.endsWith(characterId)) ||
    [magicMissile, shield, detectMagic].some(({ label }) => root === `SPELL ${label}`)
  expect(seeded.roots.filter(isCharacterCopy)).toHaveLength(characterCopyCount)
  expect({
    ...seeded,
    roots: seeded.roots.filter((root) => !isCharacterCopy(root))
  }).toEqual({
    characters: characters.map(({ characterId, label }) => `${characterId} ${label}`).sort(),
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
  for (const { characterId, label } of characters) {
    const sheet = await reader.query(api.characters.sheet.get, { id: characterId })
    expect(sheet?.identity.label).toBe(label)
    expect(sheet?.meta.hasBuilderDraft).toBe(
      characterId === STORY_CHARACTERS.draftPending.characterId
    )
  }
  expect(await stored()).toEqual(seeded)
}, 240_000)
