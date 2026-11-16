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
  REVIEW_ADMIN,
  REVIEW_STORY_BLOCKED,
  REVIEW_STORY_HOST,
  REVIEW_STORY_PEER,
  REVIEW_STORY_READER,
  STORY_CAMPAIGN,
  STORY_DEFINITIONS,
  STORY_DRAFT_ONLY,
  STORY_PLAYER_CAMPAIGN,
  STORY_RECORDS,
  STORY_SOCIAL
} from '../../tests/developmentReviewDataScenarios'
import { api, components, internal } from '../_generated/api'
import { definitionReferences } from './definitionReferences'

useLocalRoomWorker()
// The room needs a clock that moves; full-corpus work must not expire the fixture's auth session.
useRealTimeClock()

// Storybook backend stories open these records by id and expect each in its authoring state (D221).
it('gives the story account an active copy and a copy with a waiting draft per domain, one never-activated draft, its Sense definitions and its Campaign, once', async () => {
  const { t, first, second } = await publicationFixture(
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
  // The room refuses a member with no username, hosting a Social listing needs one, and the
  // fixture's accounts have none; the invitation names the reader's.
  await first.caller.mutation(api.account.updateProfile, {
    username: REVIEW_STORY_READER.username,
    bio: null
  })
  await second.caller.mutation(api.account.updateProfile, {
    username: REVIEW_STORY_HOST.username,
    bio: null
  })
  await attachRoomWorker(t)
  // START and the Scene binding go through the real room, as on the local backend.
  const roomReader = roomDevelopmentClient(first.caller)
  const roomHost = roomDevelopmentClient(second.caller)
  const room: StoryRoom = {
    checkpoint: async (campaignId) => {
      await checkpointRoom(campaignId)
    },
    buildSnapshots: seedRoomContentSnapshots,
    releaseRoom: async (campaignId) => {
      roomReader.closeRooms()
      roomHost.closeRooms()
      await closeRoom(campaignId)
    }
  }
  const clientFor = (caller: typeof first.caller): StoryClient => ({
    ...convexDevelopmentClient(caller),
    action: (action, ...args) =>
      caller.action<(ctx: ActionCtx) => Promise<FunctionReturnType<typeof action>>>((ctx) =>
        ctx.runAction(action, ...args)
      )
  })
  const reader: StoryClient = roomReader
  const stranger = async (spec: { username: string }) =>
    clientFor(
      (
        await createPartyUser(t, {
          username: spec.username,
          email: `${spec.username.toLowerCase()}@example.invalid`
        })
      ).caller
    )
  const clients = {
    [REVIEW_STORY_READER.key]: reader,
    [REVIEW_STORY_HOST.key]: roomHost,
    [REVIEW_STORY_PEER.key]: await stranger(REVIEW_STORY_PEER),
    [REVIEW_STORY_BLOCKED.key]: await stranger(REVIEW_STORY_BLOCKED),
    [REVIEW_ADMIN.key]: await stranger(REVIEW_ADMIN)
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

  // The operator step the local backend runs: the deployment-admin role change.
  const grantSuperadmin = async (userId: string) => {
    await t.mutation(internal.authAdmin.setRole, { userId, role: 'superadmin' })
  }
  await seedStoryData(connect, room, grantSuperadmin, deliverNotifications)
  const seeded = await stored()
  await seedStoryData(connect, room, grantSuperadmin, deliverNotifications)

  const connected = [
    REVIEW_STORY_READER.key,
    REVIEW_STORY_HOST.key,
    REVIEW_STORY_PEER.key,
    REVIEW_STORY_BLOCKED.key,
    REVIEW_ADMIN.key
  ]
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
  // One started Run and the next Encounter prepared beside it, the active one listed first.
  expect(runs.map(({ status }) => status)).toEqual(['ACTIVE', 'PREPARED'])
  // The started Run is bound to the presented Scene: its board as stored, the creature's token bound to
  // its actor, and the ally token the story account's own.
  const presentation = await reader.query(api.scenes.presentations.get, { campaignId })
  expect(presentation?.campaignId).toBe(campaignId)
  const presentedBoard = (boardCampaignId: string) =>
    t.run(async (ctx) => {
      const saves = (await ctx.db.query('sceneDefinitionSaves').collect()).filter(
        (row) => row.settings.campaignId === boardCampaignId && row.status === 'PUBLISHED'
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
  // The story host plays in the story Campaign, so the GM's fog controls list a player.
  const activeMemberUserIds = async (id: string) =>
    (
      await t.run((ctx) =>
        ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_status', (q) => q.eq('campaignId', id).eq('status', 'ACTIVE'))
          .collect()
      )
    )
      .map(({ userId }) => userId)
      .sort()
  expect(await activeMemberUserIds(campaignId)).toEqual([first.userId, second.userId].sort())
  expect(await presentedBoard(campaignId)).toEqual({
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
    tokens: (await ctx.db.query('encounterActorTokenBindings').collect())
      .map(({ tokenId }) => tokenId)
      .sort()
  }))
  expect(bindings).toEqual({
    scenes: 2,
    tokens: [
      reviewId(`${STORY_CAMPAIGN.slug}-scene-enemy-token`),
      reviewId(`${STORY_PLAYER_CAMPAIGN.slug}-scene-enemy-token`)
    ].sort()
  })

  // The reader plays in a second Campaign the story host owns: joined through the invitation commands,
  // with its own Run bound to the presented Scene, whose ally token the reader controls.
  const playerCampaigns = (await t.run((ctx) => ctx.db.query('campaigns').collect())).filter(
    ({ name }) => name === STORY_PLAYER_CAMPAIGN.name
  )
  expect(playerCampaigns).toHaveLength(1)
  const playerCampaignId = playerCampaigns[0]!.id
  expect(playerCampaigns[0]!.ownerUserId).toBe(second.userId)
  expect(await activeMemberUserIds(playerCampaignId)).toEqual([first.userId, second.userId].sort())
  expect(
    (await reader.query(api.encounters.projectionReads.list, { campaignId: playerCampaignId })).map(
      ({ status }) => status
    )
  ).toEqual(['ACTIVE'])
  expect(
    (await reader.query(api.scenes.presentations.get, { campaignId: playerCampaignId }))?.campaignId
  ).toBe(playerCampaignId)
  expect(await presentedBoard(playerCampaignId)).toMatchObject({
    saves: 1,
    tokens: [
      [STORY_PLAYER_CAMPAIGN.scene.allyLabel, [first.userId]],
      [STORY_PLAYER_CAMPAIGN.enemyLabel, []]
    ].sort()
  })
  const settings = await reader.query(api.campaigns.playSettings.get, { campaignId })
  expect(settings).toMatchObject({ ...STORY_CAMPAIGN.playSettings, automationMode: 'ASSISTED' })
  expect(settings.initiativePolicyDefinitionId).not.toBeNull()
  const loot = await t.run((ctx) => ctx.db.query('lootTables').collect())
  expect(loot.map(({ owner, tables }) => [owner.kind, tables.map(({ name }) => name)])).toEqual([
    ['ENCOUNTER_ACTOR', [STORY_CAMPAIGN.lootTable.name]]
  ])

  // The reader table has the peer application and invitation and a blocked, reported stranger, and
  // each queued notification reached its recipient feed once. The player Campaign's own invitation
  // (the host's to the reader) is not the peer's, so it is left out of both.
  const social = await t.run(async (ctx) => ({
    applications: (await ctx.db.query('socialApplications').collect()).map(
      ({ message, status }) => [message, status]
    ),
    invitations: (await ctx.db.query('campaignInvites').collect())
      .filter(({ recipientUsername }) => recipientUsername === REVIEW_STORY_PEER.username)
      .map(({ recipientUsername, status }) => [recipientUsername, status]),
    blocks: (await ctx.db.query('socialBlocks').collect()).length,
    reports: (await ctx.db.query('socialReports').collect()).map(({ details }) => details)
  }))
  expect(social).toEqual({
    applications: [[STORY_SOCIAL.applicationMessage, 'SUBMITTED']],
    invitations: [[REVIEW_STORY_PEER.username, 'PENDING']],
    blocks: 1,
    reports: [STORY_SOCIAL.reportDetails]
  })
  const feedCount = async (client: StoryClient, kind: string) =>
    (await client.query(api.notifications.feed, {})).items.filter(({ data }) => data.kind === kind)
      .length
  expect(await feedCount(reader, 'SOCIAL_APPLICATION_SUBMITTED')).toBe(1)
  expect(await feedCount(clients[REVIEW_STORY_PEER.key], 'SOCIAL_INVITATION_RECEIVED')).toBe(1)

  // The superadmin story account reads the reader's report in the moderation queue.
  const queue = await clients[REVIEW_ADMIN.key].query(api.social.moderation.list, {
    paginationOpts: { cursor: null, numItems: 8 }
  })
  expect(queue.page.map(({ targetKind, reason, status }) => [targetKind, reason, status])).toEqual([
    ['PROFILE', 'OTHER', 'SUBMITTED']
  ])

  // The reader's listing is open; the peer hosts its own Campaign whose listing is still a draft,
  // which the listing editor stories open.
  const hosted = async (client: StoryClient) =>
    (
      await client.query(api.social.listings.listOwned, {
        paginationOpts: { cursor: null, numItems: 8 }
      })
    ).page.map(({ title, status }) => [title, status])
  expect(await hosted(reader)).toEqual([[STORY_CAMPAIGN.name, 'OPEN']])
  expect(await hosted(clients[REVIEW_STORY_PEER.key])).toEqual([
    [STORY_SOCIAL.peerTableName, 'DRAFT']
  ])

  // The System detail stories open one definition per state, found by label.
  const owned = await t.run((ctx) =>
    ctx.db
      .query('reusableDefinitions')
      .filter((q) => q.eq(q.field('ownerUserId'), first.userId))
      .collect()
  )
  const stateOf = async (label: string) => {
    const matches = owned.filter((definition) => definition.label === label)
    expect(matches).toHaveLength(1)
    const { version, draftVersion, currentVersion } = await reader.query(definitionReferences.get, {
      definitionId: matches[0]!.id
    })
    return { version, draftVersion, currentVersion }
  }
  expect(await stateOf(STORY_DEFINITIONS.fresh.label)).toEqual({
    version: 0,
    draftVersion: null,
    currentVersion: null
  })
  expect(await stateOf(STORY_DEFINITIONS.drafted.label)).toEqual({
    version: 0,
    draftVersion: 0,
    currentVersion: null
  })
  expect(await stateOf(STORY_DEFINITIONS.published.label)).toEqual({
    version: 1,
    draftVersion: null,
    currentVersion: 1
  })
}, 240_000)
