// @vitest-environment node
import { expect, it } from 'vitest'
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { detectMagic } from '@artificer-toolkit/source-data/srd/spells/detect-magic.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { publicationFixture } from '../../tests/fixtures/publication'
import {
  attachRoomWorker,
  checkpointRoom,
  closeRoom,
  roomDevelopmentClient,
  seedRoomContentSnapshots,
  useLocalRoomWorker,
  useRealTimeClock
} from '../../tests/fixtures/localRoomWorker'
import {
  reviewId,
  seedStoryData,
  type StoryClient,
  type StoryRoom
} from '../../tests/developmentReviewData'
import {
  REVIEW_STORY_READER,
  STORY_CAMPAIGN,
  STORY_CHARACTERS,
  STORY_DRAFT_ONLY,
  STORY_RECORDS
} from '../../tests/developmentReviewDataScenarios'
import { api, components, internal } from '../_generated/api'

useLocalRoomWorker()
// The room needs a clock that moves; full-corpus work must not expire the fixture's auth session.
useRealTimeClock()

// Storybook backend stories open these records by id and expect each in its authoring state (D221).
it('gives the story account an active copy and a copy with a waiting draft per domain, one never-activated draft and its Campaign, once', async () => {
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    []
  )
  register(t)
  registerRetrier(t, 'r2/actionRetrier')
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: { model: 'session', update: { expiresAt: Date.now() + 3 * 86_400_000 } },
      paginationOpts: { cursor: null, numItems: 10 }
    })
  )
  await t.action(internal.content.seed.seed, {})
  // The room refuses a member with no username, and the fixture's accounts have none.
  await first.caller.mutation(api.account.updateProfile, { username: 'story_reader', bio: null })
  await attachRoomWorker(t)
  // START and the Scene binding go through the real room, as on the local backend.
  const roomReader = roomDevelopmentClient(first.caller)
  const reader: StoryClient = roomReader
  const room: StoryRoom = {
    checkpoint: async (campaignId) => {
      await checkpointRoom(campaignId)
    },
    buildSnapshots: seedRoomContentSnapshots,
    releaseRoom: async (campaignId) => {
      roomReader.closeRooms()
      await closeRoom(campaignId)
    }
  }
  const accounts: string[] = []
  const connect = async (spec: { key: string }) => {
    accounts.push(spec.key)
    return reader
  }
  const characters = Object.values(STORY_CHARACTERS)
  // Four copies per Character (race, background, class, equipment) and three spells for the
  // caster; the multiclass Character's Wizard is the SRD Class itself.
  const characterCopyCount = characters.length * 4 + 3
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

  const setTier = async (userId: string, tier: 'GM' | 'FREE') => {
    await t.mutation(internal.accountEntitlements.setTier, { userId, tier })
  }

  await seedStoryData(connect, setTier, room)
  const seeded = await stored()
  await seedStoryData(connect, setTier, room)

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
    drafts: [
      ...records.map(
        ({ subjectKind, ownedDraft }) => `${subjectKind} ${ownedDraft.label} ACTIVE_WITH_DRAFT`
      ),
      `${STORY_DRAFT_ONLY.subjectKind} ${STORY_DRAFT_ONLY.label} DRAFT_ONLY`
    ].sort()
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
  const fighterSheet = await reader.query(api.characters.sheet.get, {
    id: STORY_CHARACTERS.fighter.characterId
  })
  const poisoned = fighterSheet?.reference.conditionOptions.find(
    ({ label }) => label === 'Poisoned'
  )
  expect(fighterSheet?.overview.conditions.map(({ conditionTypeId }) => conditionTypeId)).toEqual([
    poisoned?.id
  ])
  // The Spells story opens the caster with every spell slot spent, once however often it is seeded.
  const casterSheet = await reader.query(api.characters.sheet.get, {
    id: STORY_CHARACTERS.caster.characterId
  })
  expect(casterSheet?.spells.slots.length).toBeGreaterThan(0)
  expect(
    casterSheet?.spells.slots.map(({ remaining, used, max }) => [remaining, used, max])
  ).toEqual(casterSheet?.spells.slots.map(({ max }) => [0, max, max]))
  expect((await reader.query(api.accountEntitlements.get, {})).tier).toBe('FREE')
  expect(await stored()).toEqual(seeded)

  // Backend stories find the Campaign by name and open its settings, Run and creature loot.
  const campaigns = (await t.run((ctx) => ctx.db.query('campaigns').collect())).filter(
    ({ name }) => name === STORY_CAMPAIGN.name
  )
  expect(campaigns).toHaveLength(1)
  const campaignId = campaigns[0]!.id
  const runs = await reader.query(api.encounters.projectionReads.list, { campaignId })
  expect(runs.map(({ status }) => status)).toEqual(['ACTIVE'])
  // The started Run is bound to the presented Scene: its board as stored, the creature's token bound to
  // its actor, and the ally token the story account's own.
  const presentation = await reader.query(api.scenes.presentations.get, { campaignId })
  expect(presentation?.campaignId).toBe(campaignId)
  const board = await t.run(async (ctx) => {
    const saves = (await ctx.db.query('sceneDefinitionSaves').collect()).filter(
      (row) => row.settings.campaignId === campaignId && row.status === 'PUBLISHED'
    )
    const entities = (
      await Promise.all(
        saves.map((save) =>
          ctx.db
            .query('sceneDefinitionEntities')
            .withIndex('by_saveId', (query) => query.eq('saveId', save.id))
            .collect()
        )
      )
    )
      .flat()
      .map((row) => row.value)
    return {
      saves: saves.length,
      fogMode: saves[0]?.settings.fogMode,
      barriers: entities
        .flatMap((value) => (value.collection === 'barriers' ? [value.entity.kind] : []))
        .sort(),
      tokens: entities
        .flatMap((value) =>
          value.collection === 'tokens'
            ? [[value.entity.label, value.entity.controlledByUserIds]]
            : []
        )
        .sort()
    }
  })
  expect(board).toEqual({
    saves: 1,
    fogMode: STORY_CAMPAIGN.scene.board.fogMode,
    barriers: ['DOOR', 'WALL', 'WALL'],
    tokens: [
      [STORY_CAMPAIGN.scene.allyLabel, [first.userId]],
      [STORY_CAMPAIGN.enemyLabel, []]
    ].sort()
  })
  const bindings = await t.run(async (ctx) => ({
    scenes: (await ctx.db.query('encounterSceneBindings').collect()).length,
    tokens: (await ctx.db.query('encounterActorTokenBindings').collect()).map(
      ({ tokenId }) => tokenId
    )
  }))
  expect(bindings).toEqual({
    scenes: 1,
    tokens: [reviewId('story-scene-enemy-token')]
  })
  const settings = await reader.query(api.campaigns.playSettings.get, { campaignId })
  expect(settings).toMatchObject({ ...STORY_CAMPAIGN.playSettings, automationMode: 'ASSISTED' })
  expect(settings.initiativePolicyDefinitionId).not.toBeNull()
  const loot = await t.run((ctx) => ctx.db.query('lootTables').collect())
  expect(loot.map(({ owner, tables }) => [owner.kind, tables.map(({ name }) => name)])).toEqual([
    ['ENCOUNTER_ACTOR', [STORY_CAMPAIGN.lootTable.name]]
  ])
}, 240_000)
