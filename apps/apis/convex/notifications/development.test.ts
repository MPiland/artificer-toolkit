import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, components } from '../_generated/api'
import { fixture } from '../../tests/fixtures/characters'

const readFixtureDelivery = makeFunctionReference<
  'query',
  { userId: string; sourcePublicIds: string[] },
  Array<{
    sourcePublicId: string
    status: 'PENDING' | 'DISPATCHED' | 'CANCELLED' | 'FAILED'
    feedRecorded: boolean
    attemptCount: number
    providerEmailId: string | null
    providerStatus: string | null
  } | null>
>('notifications/development:readFixtureDelivery')

const removeFixtureDelivery = makeFunctionReference<
  'mutation',
  { userId: string; sourcePublicIds: string[] },
  null
>('notifications/development:removeFixtureDelivery')
const admitFixturePlayer = makeFunctionReference<
  'mutation',
  { ownerUserId: string; playerUserId: string; campaignId: string },
  null
>('encounters/developmentCampaign:admitFixturePlayer')

async function setup(count = 2) {
  const base = await fixture()
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
  await base.t.mutation(admitFixturePlayer, {
    ownerUserId: base.owner.userId,
    playerUserId: base.other.userId,
    campaignId: campaign.id
  })
  const announcements = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      base.owner.caller.mutation(api.campaigns.announcements.create, {
        campaignId: campaign.id,
        commandId: crypto.randomUUID(),
        scope: 'TABLE',
        title: index === 0 ? 'Notification fixture first' : 'Notification fixture second',
        body: 'Fixture notification body'
      })
    )
  )
  const sourcePublicIds = announcements.map((announcement) => announcement.announcementPublicId)
  return { ...base, campaign, sourcePublicIds }
}

async function deliveryState(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
    intents: await ctx.db
      .query('notificationDeliveryIntents')
      .withIndex('by_recipientUserId', (q) => q.eq('recipientUserId', base.other.userId))
      .take(4),
    feed: await ctx.db
      .query('notificationFeedItems')
      .withIndex('by_userId_occurredAt_id', (q) => q.eq('userId', base.other.userId))
      .take(4)
  }))
}

describe('development notification fixture cleanup', () => {
  it('reads and removes bounded campaign delivery while preserving another recipient', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const intents = await ctx.db
        .query('notificationDeliveryIntents')
        .withIndex('by_recipientUserId', (q) => q.eq('recipientUserId', base.other.userId))
        .take(3)
      for (const intent of intents) {
        if (!intent.data) throw new Error('Missing fixture notification data.')
        await ctx.db.insert('notificationFeedItems', {
          id: intent.id,
          workflowKey: intent.workflowKey,
          sourceKind: intent.sourceKind,
          sourcePublicId: intent.sourcePublicId,
          groupingKey: intent.groupingKey,
          data: intent.data,
          occurredAt: intent.occurredAt,
          seenAt: null,
          readAt: null,
          userId: base.other.userId
        })
      }
      const first = intents[0]
      if (!first?.data) throw new Error('Missing fixture notification data.')
      await ctx.db.insert('notificationFeedItems', {
        id: crypto.randomUUID(),
        workflowKey: first.workflowKey,
        sourceKind: first.sourceKind,
        sourcePublicId: first.sourcePublicId,
        groupingKey: first.groupingKey,
        data: first.data,
        occurredAt: first.occurredAt,
        seenAt: null,
        readAt: null,
        userId: base.owner.userId
      })
    })

    await expect(
      base.t.query(readFixtureDelivery, {
        userId: base.other.userId,
        sourcePublicIds: base.sourcePublicIds
      })
    ).resolves.toEqual(
      base.sourcePublicIds.map((sourcePublicId) =>
        expect.objectContaining({
          sourcePublicId,
          status: 'PENDING',
          feedRecorded: false,
          attemptCount: 0,
          providerEmailId: null,
          providerStatus: null
        })
      )
    )

    await base.t.mutation(removeFixtureDelivery, {
      userId: base.other.userId,
      sourcePublicIds: base.sourcePublicIds
    })

    expect(await deliveryState(base)).toEqual({ intents: [], feed: [] })
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('notificationFeedItems')
          .withIndex('by_userId_occurredAt_id', (q) => q.eq('userId', base.owner.userId))
          .take(2)
      )
    ).toHaveLength(1)
  }, 30_000)

  it('rejects mismatched and overflowing delivery fixtures atomically', async () => {
    const base = await setup(1)
    const before = await deliveryState(base)
    await expect(
      base.t.mutation(removeFixtureDelivery, {
        userId: base.other.userId,
        sourcePublicIds: [crypto.randomUUID()]
      })
    ).rejects.toThrow('Fixture notification delivery dependency mismatch.')
    expect(await deliveryState(base)).toEqual(before)

    await base.t.run(async (ctx) => {
      const existing = await ctx.db
        .query('notificationDeliveryIntents')
        .withIndex('by_recipientUserId', (q) => q.eq('recipientUserId', base.other.userId))
        .unique()
      if (!existing?.data || existing.data.kind !== 'CAMPAIGN_ANNOUNCEMENT')
        throw new Error('Missing fixture notification intent.')
      const { _id: _intentId, _creationTime: _intentCreatedAt, ...stored } = existing
      for (let index = 0; index < 2; index++) {
        const sourcePublicId = crypto.randomUUID()
        await ctx.db.insert('notificationDeliveryIntents', {
          ...stored,
          id: crypto.randomUUID(),
          sourcePublicId,
          data: { ...existing.data, announcementPublicId: sourcePublicId }
        })
      }
    })
    const overflow = await deliveryState(base)

    await expect(
      base.t.mutation(removeFixtureDelivery, {
        userId: base.other.userId,
        sourcePublicIds: base.sourcePublicIds
      })
    ).rejects.toThrow('Fixture notification delivery dependency mismatch.')
    expect(await deliveryState(base)).toEqual(overflow)
  }, 30_000)
})
