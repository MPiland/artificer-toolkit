// @vitest-environment node
import { expect, it } from 'vitest'
import type { FunctionReturnType } from 'convex/server'
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { publicationFixture } from '../../tests/fixtures/publication'
import { convexDevelopmentClient } from '../../tests/fixtures/convexDevelopmentClient'
import { createPartyUser } from '../../tests/fixtures/partyPlayer'
import type { ActionCtx } from '../_generated/server'
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
  REVIEW_STORY_BLOCKED,
  REVIEW_STORY_PEER,
  REVIEW_STORY_READER,
  STORY_CAMPAIGN,
  STORY_DRAFT_ONLY,
  STORY_RECORDS,
  STORY_SOCIAL
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
  // The room refuses a member with no username, and the fixture's accounts have none; hosting a
  // Social listing needs one too.
  await first.caller.mutation(api.account.updateProfile, {
    username: REVIEW_STORY_READER.username,
    bio: null
  })
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
  const stranger = async (spec: { username: string }): Promise<StoryClient> => {
    const { caller } = await createPartyUser(t, {
      username: spec.username,
      email: `${spec.username.toLowerCase()}@example.invalid`
    })
    return {
      ...convexDevelopmentClient(caller),
      action: (action, ...args) =>
        caller.action<(ctx: ActionCtx) => Promise<FunctionReturnType<typeof action>>>((ctx) =>
          ctx.runAction(action, ...args)
        )
    }
  }
  const clients = {
    [REVIEW_STORY_READER.key]: reader,
    [REVIEW_STORY_PEER.key]: await stranger(REVIEW_STORY_PEER),
    [REVIEW_STORY_BLOCKED.key]: await stranger(REVIEW_STORY_BLOCKED)
  }
  }
  const accounts: string[] = []
  const connect = async (spec: { key: string }) => {
    accounts.push(spec.key)
    return clients[spec.key as keyof typeof clients]
  }
  // Queued notifications reach the feeds when the backend dispatcher runs.
  const deliverNotifications = async () => {
    await t.mutation(internal.notifications.delivery.dispatch, {})
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

  await seedStoryData(connect, room, deliverNotifications)
  const seeded = await stored()
  await seedStoryData(connect, room, deliverNotifications)

  const connected = [REVIEW_STORY_READER.key, REVIEW_STORY_PEER.key, REVIEW_STORY_BLOCKED.key]
  expect(accounts).toEqual([...connected, ...connected])
  const records = Object.values(STORY_RECORDS)
  expect(seeded).toEqual({
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

  // The reader table has the peer application and invitation and a blocked, reported stranger, and
  // each queued notification reached its recipient feed once.
  const social = await t.run(async (ctx) => ({
    applications: (await ctx.db.query('socialApplications').collect()).map(
      ({ message, status }) => [message, status]
    ),
    invitations: (await ctx.db.query('campaignInvites').collect()).map(
      ({ recipientUsername, status }) => [recipientUsername, status]
    ),
    blocks: (await ctx.db.query('socialBlocks').collect()).length,
    reports: (await ctx.db.query('socialReports').collect()).map(({ details }) => details),
    feeds: (await ctx.db.query('notificationFeedItems').collect())
      .map(({ data }) => data.kind)
      .sort()
  }))
  expect(social).toEqual({
    applications: [[STORY_SOCIAL.applicationMessage, 'SUBMITTED']],
    invitations: [[REVIEW_STORY_PEER.username, 'PENDING']],
    blocks: 1,
    reports: [STORY_SOCIAL.reportDetails],
    feeds: ['SOCIAL_APPLICATION_SUBMITTED', 'SOCIAL_INVITATION_RECEIVED']
  })
}, 240_000)
