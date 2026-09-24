import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { campaignStoredContentShareSchema } from '@artificer-toolkit/schema/projections/campaignContentPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { campaignStoredCommandSchema } from '@artificer-toolkit/schema/projections/campaignSessionPersistence'
import { campaignStoredOwnershipTransferSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, components } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const removeFixtureCampaign = makeFunctionReference<
  'mutation',
  { ownerUserId: string; playerUserId: string; campaignId: string; characterId: string },
  null
>('encounters/developmentCampaign:removeFixtureCampaign')
const admitFixturePlayer = makeFunctionReference<
  'mutation',
  { ownerUserId: string; playerUserId: string; campaignId: string },
  null
>('encounters/developmentCampaign:admitFixturePlayer')
const finishSession = makeFunctionReference<
  'mutation',
  { campaignId: string; sessionId: string; expectedVersion: number; commandId: string },
  unknown
>('campaigns/sessionFinish:finish')
const requestOwnershipTransfer = makeFunctionReference<
  'mutation',
  { campaignId: string; recipientUserId: string },
  { ok: true }
>('campaigns/ownership:request')

async function setup() {
  const base = await readyCharacterFixture()
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const cleanup = {
    ownerUserId: base.owner.userId,
    playerUserId: base.other.userId,
    campaignId: campaign.id,
    characterId: crypto.randomUUID()
  }
  return { ...base, campaign, cleanup }
}

async function insertShare(
  base: Awaited<ReturnType<typeof setup>>,
  subjectKind: 'BACKGROUND' | 'EQUIPMENT',
  subjectId: string,
  sharedBy = base.owner.userId
) {
  await base.t.run((ctx) =>
    ctx.db.insert(
      'campaignContentShares',
      campaignStoredContentShareSchema.parse({
        campaignId: base.campaign.id,
        subjectKind,
        subjectId,
        sharedBy,
        createdAt: base.campaign.createdAt,
        updatedAt: base.campaign.updatedAt
      })
    )
  )
}

async function insertContentRemovalEvents(
  base: Awaited<ReturnType<typeof setup>>,
  count: number,
  actorUserId = base.owner.userId
) {
  await base.t.run(async (ctx) => {
    for (let index = 0; index < count; index++)
      await ctx.db.insert(
        'campaignEvents',
        campaignStoredEventSchema.parse({
          id: crypto.randomUUID(),
          campaignId: base.campaign.id,
          actorUserId,
          type: 'CAMPAIGN_CONTENT_SHARES_REMOVED',
          visibility: 'OWNER',
          subjectCharacterId: null,
          payloadJson: JSON.stringify({ fixture: true }),
          visibleInHistory: true,
          commandId: crypto.randomUUID(),
          createdAt: base.campaign.createdAt
        })
      )
  })
}

async function campaignState(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
    campaign: await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique(),
    shares: await ctx.db
      .query('campaignContentShares')
      .withIndex('by_campaignId_subjectKind_subjectId', (q) => q.eq('campaignId', base.campaign.id))
      .take(3),
    events: await ctx.db
      .query('campaignEvents')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
      .take(6),
    announcements: await ctx.db
      .query('campaignAnnouncements')
      .withIndex('by_campaignId_createdAt_publicId', (q) => q.eq('campaignId', base.campaign.id))
      .take(3),
    sessions: await ctx.db
      .query('campaignSessions')
      .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', base.campaign.id))
      .take(2),
    commands: await ctx.db
      .query('campaignCommands')
      .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', base.campaign.id))
      .take(2),
    ownershipTransfer: await ctx.db
      .query('campaignOwnershipTransfers')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique(),
    roots: await Promise.all(
      [acolyte.id, club.id].map((id) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    )
  }))
}

async function announce(base: Awaited<ReturnType<typeof setup>>, title: string) {
  return base.owner.caller.mutation(api.campaigns.announcements.create, {
    campaignId: base.campaign.id,
    commandId: crypto.randomUUID(),
    scope: 'TABLE',
    title,
    body: 'Fixture notification body'
  })
}

async function finishFixtureSession(base: Awaited<ReturnType<typeof setup>>) {
  const session = await base.owner.caller.mutation(api.campaigns.sessions.create, {
    campaignId: base.campaign.id
  })
  await base.owner.caller.mutation(finishSession, {
    campaignId: base.campaign.id,
    sessionId: session.id,
    expectedVersion: session.version,
    commandId: crypto.randomUUID()
  })
  return session
}

describe('development Campaign fixture cleanup', () => {
  it('removes the Scene fixture Session and exact player-departure receipt atomically', async () => {
    const base = await setup()
    await base.t.mutation(admitFixturePlayer, {
      ownerUserId: base.owner.userId,
      playerUserId: base.other.userId,
      campaignId: base.campaign.id
    })
    await base.owner.caller.mutation(api.campaigns.sessions.create, {
      campaignId: base.campaign.id
    })
    const current = await base.owner.caller.query(api.campaigns.queries.get, {
      id: base.campaign.id
    })
    const member = current.memberships.find((entry) => entry.userId === base.other.userId)!
    await base.owner.caller.mutation(api.campaigns.membershipDeparture.removeMember, {
      campaignId: base.campaign.id,
      userId: base.other.userId,
      commandId: crypto.randomUUID(),
      expectedCampaignVersion: current.version,
      expectedMembershipAccessStartedAt: member.accessStartedAt
    })
    const before = await campaignState(base)
    expect(before.sessions).toHaveLength(1)
    expect(before.events).toHaveLength(1)
    const event = before.events[0]!
    const payload: Record<string, unknown> = JSON.parse(event.payloadJson)
    await base.t.run((ctx) =>
      ctx.db.patch(event._id, {
        payloadJson: JSON.stringify({
          ...payload,
          departingMembership: {
            accessStartedAt: member.accessStartedAt,
            userId: crypto.randomUUID()
          }
        })
      })
    )
    const invalid = await campaignState(base)
    await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).rejects.toThrow(
      'Fixture Campaign dependency or ownership mismatch.'
    )
    expect(await campaignState(base)).toEqual(invalid)
    await base.t.run((ctx) => ctx.db.patch(event._id, { payloadJson: event.payloadJson }))
    await expect(
      base.t.run(async (ctx) => {
        await ctx.runMutation(removeFixtureCampaign, base.cleanup)
        throw new Error('Injected departure cleanup rollback')
      })
    ).rejects.toThrow('Injected departure cleanup rollback')
    expect(await campaignState(base)).toEqual(before)
    await base.t.mutation(removeFixtureCampaign, base.cleanup)
    expect(await campaignState(base)).toMatchObject({ campaign: null, sessions: [], events: [] })
    await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).resolves.toBeNull()
  }, 30_000)

  it('removes a real pending ownership request with its fixture Campaign', async () => {
    const base = await setup()
    await base.t.mutation(admitFixturePlayer, {
      ownerUserId: base.cleanup.ownerUserId,
      playerUserId: base.cleanup.playerUserId,
      campaignId: base.cleanup.campaignId
    })
    await expect(
      base.owner.caller.mutation(requestOwnershipTransfer, {
        campaignId: base.campaign.id,
        recipientUserId: base.other.userId
      })
    ).resolves.toEqual({ ok: true })
    expect((await campaignState(base)).ownershipTransfer).toMatchObject({
      fromUserId: base.owner.userId,
      toUserId: base.other.userId
    })

    await base.t.mutation(removeFixtureCampaign, base.cleanup)
    expect(await campaignState(base)).toMatchObject({ campaign: null, ownershipTransfer: null })
    await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).resolves.toBeNull()
  }, 30_000)

  it('rejects an ownership request for a foreign recipient without writes', async () => {
    const base = await setup()
    await base.t.run((ctx) =>
      ctx.db.insert(
        'campaignOwnershipTransfers',
        campaignStoredOwnershipTransferSchema.parse({
          campaignId: base.campaign.id,
          fromUserId: base.owner.userId,
          toUserId: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 60_000).toISOString()
        })
      )
    )
    const before = await campaignState(base)

    await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).rejects.toThrow(
      'Fixture Campaign dependency or ownership mismatch.'
    )
    expect(await campaignState(base)).toEqual(before)
  }, 30_000)

  it('removes one native FINISH_SESSION receipt with its fixture Session and rolls back atomically', async () => {
    const base = await setup()
    await finishFixtureSession(base)
    const before = await campaignState(base)
    expect(before.sessions).toHaveLength(1)
    expect(before.commands).toHaveLength(1)
    await expect(
      base.t.run(async (ctx) => {
        await ctx.runMutation(removeFixtureCampaign, base.cleanup)
        throw new Error('Injected Session cleanup rollback')
      })
    ).rejects.toThrow('Injected Session cleanup rollback')
    expect(await campaignState(base)).toEqual(before)

    await base.t.mutation(removeFixtureCampaign, base.cleanup)
    expect(await campaignState(base)).toMatchObject({
      campaign: null,
      sessions: [],
      commands: []
    })
    await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).resolves.toBeNull()
  }, 30_000)

  it.each(['foreign result', 'second command', 'missing receipt'])(
    'rejects a %s FINISH_SESSION receipt without writes',
    async (kind) => {
      const base = await setup()
      await finishFixtureSession(base)
      await base.t.run(async (ctx) => {
        const command = await ctx.db
          .query('campaignCommands')
          .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', base.campaign.id))
          .unique()
        if (!command || command.commandType !== 'FINISH_SESSION')
          throw new Error('Missing Session receipt.')
        if (kind === 'missing receipt') {
          await ctx.db.delete(command._id)
          return
        }
        if (kind === 'foreign result') {
          await ctx.db.patch(command._id, {
            resultPayload: { ...command.resultPayload, campaignId: crypto.randomUUID() }
          })
          return
        }
        const { _id, _creationTime, ...stored } = command
        await ctx.db.insert(
          'campaignCommands',
          campaignStoredCommandSchema.parse({ ...stored, commandId: crypto.randomUUID() })
        )
      })
      const before = await campaignState(base)

      await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).rejects.toThrow(
        'Fixture Campaign dependency or ownership mismatch.'
      )
      expect(await campaignState(base)).toEqual(before)
    },
    30_000
  )

  it.each([1, 2])(
    'removes owner shares and receipts after %i unshare(s)',
    async (removedCount) => {
      const base = await setup()
      await insertShare(base, 'BACKGROUND', acolyte.id)
      await insertShare(base, 'EQUIPMENT', club.id)
      const receipt = await base.owner.caller.mutation(api.campaigns.contentShares.unshare, {
        campaignId: base.campaign.id,
        subjectKind: 'BACKGROUND',
        subjectId: acolyte.id,
        sharedBy: base.owner.userId,
        expectedCampaignVersion: base.campaign.version,
        commandId: crypto.randomUUID()
      })
      expect(receipt.campaignVersion).toBe(base.campaign.version + 1)
      if (removedCount === 2) {
        await base.owner.caller.mutation(api.campaigns.contentShares.unshare, {
          campaignId: base.campaign.id,
          subjectKind: 'EQUIPMENT',
          subjectId: club.id,
          sharedBy: base.owner.userId,
          expectedCampaignVersion: receipt.campaignVersion,
          commandId: crypto.randomUUID()
        })
      }
      const before = await campaignState(base)
      expect(before.shares).toHaveLength(2 - removedCount)
      expect(before.events).toHaveLength(removedCount)
      expect(before.roots.every(Boolean)).toBe(true)

      await base.t.mutation(removeFixtureCampaign, base.cleanup)

      const after = await campaignState(base)
      expect(after.campaign).toBeNull()
      expect(after.shares).toEqual([])
      expect(after.events).toEqual([])
      expect(after.roots).toEqual(before.roots)
    },
    30000
  )

  it('removes four valid owner content-removal events', async () => {
    const base = await setup()
    await insertContentRemovalEvents(base, 4)
    expect((await campaignState(base)).events).toHaveLength(4)

    await base.t.mutation(removeFixtureCampaign, base.cleanup)

    expect((await campaignState(base)).campaign).toBeNull()
    expect((await campaignState(base)).events).toEqual([])
  }, 30_000)

  it('rejects five content-removal events without deleting fixture rows', async () => {
    const base = await setup()
    await insertContentRemovalEvents(base, 5)
    const before = await campaignState(base)

    await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).rejects.toThrow(
      'Fixture Campaign dependency or ownership mismatch.'
    )
    expect(await campaignState(base)).toEqual(before)
  }, 30_000)

  it.each([
    ['a foreign share', true],
    ['an unrelated event', false]
  ])(
    'rejects %s without deleting fixture rows',
    async (_label, foreignShare) => {
      const base = await setup()
      await insertShare(
        base,
        'BACKGROUND',
        acolyte.id,
        foreignShare ? base.other.userId : base.owner.userId
      )
      if (!foreignShare) {
        await base.t.run((ctx) =>
          ctx.db.insert('campaignEvents', {
            id: crypto.randomUUID(),
            campaignId: base.campaign.id,
            actorUserId: base.owner.userId,
            type: 'FIXTURE_EVENT',
            visibility: 'OWNER',
            subjectCharacterId: null,
            payloadJson: JSON.stringify({ fixture: true }),
            visibleInHistory: true,
            createdAt: base.campaign.createdAt
          })
        )
      }
      const before = await campaignState(base)

      await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).rejects.toThrow(
        'Fixture Campaign dependency or ownership mismatch.'
      )

      expect(await campaignState(base)).toEqual(before)
    },
    30000
  )

  it('removes the bounded Table notification announcements', async () => {
    const base = await setup()
    await base.t.mutation(admitFixturePlayer, {
      ownerUserId: base.owner.userId,
      playerUserId: base.other.userId,
      campaignId: base.campaign.id
    })
    await announce(base, 'Notification fixture first')
    await announce(base, 'Notification fixture second')

    expect((await campaignState(base)).announcements).toHaveLength(2)
    await base.t.mutation(removeFixtureCampaign, base.cleanup)
    expect(await campaignState(base)).toMatchObject({ campaign: null, announcements: [] })
  }, 30_000)

  it.each(['foreign', 'mixed'])(
    'rejects %s announcement fixtures atomically',
    async (kind) => {
      const base = await setup()
      await base.t.mutation(admitFixturePlayer, {
        ownerUserId: base.owner.userId,
        playerUserId: base.other.userId,
        campaignId: base.campaign.id
      })
      await announce(base, 'Notification fixture first')
      await base.t.run(async (ctx) => {
        const announcement = await ctx.db
          .query('campaignAnnouncements')
          .withIndex('by_campaignId_createdAt_publicId', (q) =>
            q.eq('campaignId', base.campaign.id)
          )
          .unique()
        if (!announcement) throw new Error('Missing fixture announcement.')
        if (kind === 'foreign') {
          await ctx.db.patch(announcement._id, { authorUserId: base.other.userId })
          return
        }
        await ctx.db.insert('campaignCharacterAssignments', {
          campaignId: base.campaign.id,
          userId: base.other.userId,
          characterId: base.cleanup.characterId,
          assignedAt: base.campaign.createdAt
        })
      })
      const before = await campaignState(base)

      await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).rejects.toThrow(
        'Fixture Campaign dependency or ownership mismatch.'
      )

      expect(await campaignState(base)).toEqual(before)
    },
    30_000
  )

  it('removes bounded conversation, notebook and assigned-Character fixture references', async () => {
    const base = await setup()
    await base.other.caller.mutation(api.account.updateProfile, {
      username: 'FixturePlayer',
      bio: null
    })
    await base.t.mutation(admitFixturePlayer, {
      ownerUserId: base.owner.userId,
      playerUserId: base.other.userId,
      campaignId: base.campaign.id
    })
    await base.owner.caller.mutation(api.campaigns.conversations.open, {
      campaignId: base.campaign.id,
      kind: 'TABLE'
    })
    await base.other.caller.mutation(api.campaigns.chat.send, {
      campaignId: base.campaign.id,
      room: 'TABLE',
      mode: 'OOC',
      body: 'Fixture collaboration message',
      clientNonce: crypto.randomUUID()
    })
    await base.owner.caller.mutation(api.campaigns.notebooks.create, {
      campaignId: base.campaign.id,
      title: 'Fixture notebook',
      content: '<p>Fixture note</p>',
      visibility: 'GM_PRIVATE',
      category: 'GENERAL'
    })
    await base.t.run((ctx) =>
      ctx.db.insert('campaignCharacterAssignments', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        characterId: base.cleanup.characterId,
        assignedAt: base.campaign.createdAt
      })
    )
    const readCollaboration = () =>
      base.t.run(async (ctx) => ({
        conversations: await ctx.db.query('campaignConversations').collect(),
        members: await ctx.db.query('campaignConversationMembers').collect(),
        entries: await ctx.db.query('campaignConversationEntries').collect(),
        payloads: await ctx.db.query('campaignConversationEntryPayloads').collect(),
        notes: await ctx.db.query('campaignNotebookSections').collect(),
        assignments: await ctx.db.query('campaignCharacterAssignments').collect()
      }))
    const valid = await readCollaboration()
    await base.t.run((ctx) =>
      ctx.db.patch(valid.entries[0]!._id, { authorUserId: crypto.randomUUID() })
    )
    const invalid = await readCollaboration()
    await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).rejects.toThrow(
      'Fixture Campaign collaboration dependency mismatch.'
    )
    expect(await readCollaboration()).toEqual(invalid)
    expect((await campaignState(base)).campaign).not.toBeNull()
    await base.t.run((ctx) =>
      ctx.db.patch(valid.entries[0]!._id, { authorUserId: base.other.userId })
    )
    await base.t.mutation(removeFixtureCampaign, base.cleanup)
    expect(await readCollaboration()).toEqual({
      conversations: [],
      members: [],
      entries: [],
      payloads: [],
      notes: [],
      assignments: []
    })
  }, 30_000)
})
