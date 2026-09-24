import { Resend } from '@convex-dev/resend'
import { register } from '@convex-dev/resend/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from '../_generated/api'
import { fixture } from '../../tests/fixtures/socialAdmission'
import { isNotificationSourceEligible } from './source'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('notification source eligibility', () => {
  it('uses current Social source authority and retains valid historical decisions', async () => {
    const base = await fixture()
    const submitted = {
      kind: 'SOCIAL_APPLICATION_SUBMITTED' as const,
      sourcePublicId: base.applicationId,
      listingPublicId: base.listingId,
      listingTitle: base.campaign.name,
      applicantUsername: 'TransferPlayer',
      occurredAt: base.campaign.createdAt
    }
    const decided = {
      kind: 'SOCIAL_APPLICATION_DECIDED' as const,
      sourcePublicId: base.acceptedApplicationId,
      listingPublicId: base.listingId,
      listingTitle: base.campaign.name,
      decision: 'ACCEPTED' as const,
      occurredAt: base.campaign.createdAt
    }
    const received = {
      kind: 'SOCIAL_INVITATION_RECEIVED' as const,
      sourcePublicId: base.inviteId,
      listingPublicId: base.listingId,
      listingTitle: base.campaign.name,
      hostUsername: 'TransferOwner',
      expiresAt: new Date(Date.parse(base.campaign.createdAt) + 86_400_000).toISOString(),
      occurredAt: base.campaign.createdAt
    }
    expect(
      await base.t.run((ctx) => isNotificationSourceEligible(ctx, base.owner.userId, submitted))
    ).toBe(true)
    expect(
      await base.t.run((ctx) => isNotificationSourceEligible(ctx, base.other.userId, submitted))
    ).toBe(false)
    expect(
      await base.t.run((ctx) => isNotificationSourceEligible(ctx, base.other.userId, decided))
    ).toBe(true)
    expect(
      await base.t.run((ctx) => isNotificationSourceEligible(ctx, base.other.userId, received))
    ).toBe(true)

    await base.t.run(async (ctx) => {
      const [listing, campaign, invitation] = await Promise.all([
        ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listingId))
          .unique(),
        ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
          .unique(),
        ctx.db
          .query('campaignInvites')
          .withIndex('by_publicId', (q) => q.eq('id', base.inviteId))
          .unique()
      ])
      if (!listing || !campaign || !invitation) throw new Error('Missing Social source fixture.')
      await ctx.db.patch(listing._id, { status: 'CLOSED' })
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
      await ctx.db.patch(invitation._id, { status: 'DECLINED' })
    })
    const invitationDecided = {
      kind: 'SOCIAL_INVITATION_DECIDED' as const,
      sourcePublicId: base.inviteId,
      listingPublicId: base.listingId,
      listingTitle: base.campaign.name,
      recipientUsername: 'TransferPlayer',
      decision: 'DECLINED' as const,
      occurredAt: base.campaign.createdAt
    }
    expect(
      await base.t.run((ctx) => isNotificationSourceEligible(ctx, base.other.userId, decided))
    ).toBe(true)
    expect(
      await base.t.run((ctx) =>
        isNotificationSourceEligible(ctx, base.owner.userId, invitationDecided)
      )
    ).toBe(true)
    expect(
      await base.t.run((ctx) => isNotificationSourceEligible(ctx, base.owner.userId, submitted))
    ).toBe(false)
  })

  it('rechecks current Campaign and PARTY access', async () => {
    const base = await fixture()
    const table = await base.owner.caller.mutation(api.campaigns.announcements.create, {
      campaignId: base.campaign.id,
      commandId: crypto.randomUUID(),
      scope: 'TABLE',
      title: 'Notice',
      body: 'Table notice'
    })
    const party = await base.other.caller.mutation(api.campaigns.conversations.open, {
      campaignId: base.campaign.id,
      kind: 'PARTY'
    })
    const privateAnnouncement = await base.owner.caller.mutation(
      api.campaigns.announcements.create,
      {
        campaignId: base.campaign.id,
        commandId: crypto.randomUUID(),
        scope: 'PARTY',
        partyId: party.id,
        title: 'Party notice',
        body: 'Party notice'
      }
    )
    for (const announcement of [table, privateAnnouncement]) {
      expect(
        await base.t.run((ctx) =>
          isNotificationSourceEligible(ctx, base.other.userId, {
            kind: 'CAMPAIGN_ANNOUNCEMENT',
            announcementPublicId: announcement.announcementPublicId,
            campaignPublicId: base.campaign.publicId,
            scope: announcement.scope,
            summary: 'A new Campaign announcement is available.',
            occurredAt: announcement.createdAt
          })
        )
      ).toBe(true)
    }
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignConversationMembers')
        .withIndex('by_conversationId_userId', (q) =>
          q.eq('conversationId', party.id).eq('userId', base.other.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing PARTY membership fixture.')
      await ctx.db.delete(membership._id)
    })
    expect(
      await base.t.run((ctx) =>
        isNotificationSourceEligible(ctx, base.other.userId, {
          kind: 'CAMPAIGN_ANNOUNCEMENT',
          announcementPublicId: privateAnnouncement.announcementPublicId,
          campaignPublicId: base.campaign.publicId,
          scope: 'PARTY',
          summary: 'A new Campaign announcement is available.',
          occurredAt: privateAnnouncement.createdAt
        })
      )
    ).toBe(false)
  })

  it('cancels future Social handoffs after a block or profile suspension', async () => {
    const base = await fixture()
    const data = {
      kind: 'SOCIAL_APPLICATION_SUBMITTED' as const,
      sourcePublicId: base.applicationId,
      listingPublicId: base.listingId,
      listingTitle: base.campaign.name,
      applicantUsername: 'TransferPlayer',
      occurredAt: base.campaign.createdAt
    }
    await base.t.run(async (ctx) => {
      const [host, applicant] = await Promise.all([
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique(),
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
      ])
      if (!host || !applicant) throw new Error('Missing Social profiles.')
      await ctx.db.insert('socialBlocks', {
        blockerProfileId: applicant.id,
        blockedProfileId: host.id,
        createdAt: new Date().toISOString()
      })
    })
    expect(
      await base.t.run((ctx) => isNotificationSourceEligible(ctx, base.owner.userId, data))
    ).toBe(false)
    await base.t.mutation(internal.notifications.delivery.dispatch, {})
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('notificationDeliveryIntents')
          .withIndex('by_recipientUserId_workflowKey_sourcePublicId', (q) =>
            q
              .eq('recipientUserId', base.owner.userId)
              .eq('workflowKey', 'social-application-submitted')
              .eq('sourcePublicId', base.applicationId)
          )
          .unique()
      )
    ).toMatchObject({ status: 'CANCELLED', feedRecorded: false })
    await base.t.run(async (ctx) => {
      const applicant = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
      if (!applicant) throw new Error('Missing Social applicant.')
      await ctx.db.patch(applicant._id, { status: 'SUSPENDED' })
    })
    expect(
      await base.t.run((ctx) => isNotificationSourceEligible(ctx, base.owner.userId, data))
    ).toBe(false)

    const reverse = await fixture()
    await reverse.t.run(async (ctx) => {
      const [host, applicant] = await Promise.all([
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', reverse.owner.userId))
          .unique(),
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', reverse.other.userId))
          .unique()
      ])
      if (!host || !applicant) throw new Error('Missing Social profiles.')
      await ctx.db.insert('socialBlocks', {
        blockerProfileId: host.id,
        blockedProfileId: applicant.id,
        createdAt: new Date().toISOString()
      })
    })
    expect(
      await reverse.t.run((ctx) =>
        isNotificationSourceEligible(ctx, reverse.owner.userId, {
          ...data,
          sourcePublicId: reverse.applicationId,
          listingPublicId: reverse.listingId,
          listingTitle: reverse.campaign.name,
          occurredAt: reverse.campaign.createdAt
        })
      )
    ).toBe(false)
  })

  it('cancels a Resend handoff when a block appears after email rendering', async () => {
    const base = await fixture()
    register(base.t)
    const sendEmail = vi.spyOn(Resend.prototype, 'sendEmail')
    vi.stubEnv('MAIL_DELIVERY_MODE', 'resend')
    vi.stubEnv('NOTIFICATION_EMAIL_FROM', 'Artificer Toolkit <notifications@example.test>')
    const intent = await base.t.run((ctx) =>
      ctx.db
        .query('notificationDeliveryIntents')
        .withIndex('by_recipientUserId_workflowKey_sourcePublicId', (q) =>
          q
            .eq('recipientUserId', base.owner.userId)
            .eq('workflowKey', 'social-application-submitted')
            .eq('sourcePublicId', base.applicationId)
        )
        .unique()
    )
    if (!intent) throw new Error('Missing notification intent fixture.')
    expect(
      await base.t.query(internal.notifications.delivery.emailInput, {
        intentId: intent._id,
        attempt: 0
      })
    ).not.toBeNull()
    await base.t.run(async (ctx) => {
      const [host, applicant] = await Promise.all([
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique(),
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
      ])
      if (!host || !applicant) throw new Error('Missing Social profiles.')
      await ctx.db.insert('socialBlocks', {
        blockerProfileId: host.id,
        blockedProfileId: applicant.id,
        createdAt: new Date().toISOString()
      })
    })
    await base.t.mutation(internal.notifications.delivery.enqueueRendered, {
      intentId: intent._id,
      attempt: 0,
      subject: 'Rendered before the block',
      html: '<p>Rendered before the block</p>'
    })
    expect(await base.t.run((ctx) => ctx.db.get(intent._id))).toMatchObject({
      status: 'CANCELLED',
      providerEmailId: null
    })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('fails a missing recipient before evaluating a missing source', async () => {
    const base = await fixture()
    await base.t.run(async (ctx) => {
      const [application, profile] = await Promise.all([
        ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', base.applicationId))
          .unique(),
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
      ])
      if (!application || !profile) throw new Error('Missing notification fixture.')
      await ctx.db.delete(application._id)
      await ctx.db.delete(profile._id)
    })
    await base.t.mutation(internal.notifications.delivery.dispatch, {})
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('notificationDeliveryIntents')
          .withIndex('by_recipientUserId_workflowKey_sourcePublicId', (q) =>
            q
              .eq('recipientUserId', base.owner.userId)
              .eq('workflowKey', 'social-application-submitted')
              .eq('sourcePublicId', base.applicationId)
          )
          .unique()
      )
    ).toMatchObject({ status: 'FAILED', lastErrorCode: 'RECIPIENT_UNAVAILABLE' })
  })

  it('rejects forged owner authority before recording feed or provider work', async () => {
    const base = await fixture()
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing Campaign owner membership.')
      await ctx.db.patch(membership._id, { role: 'PLAYER' })
    })
    await expect(base.t.mutation(internal.notifications.delivery.dispatch, {})).rejects.toThrow(
      'Stored Campaign authority mismatch.'
    )
    const state = await base.t.run(async (ctx) => ({
      intents: await ctx.db.query('notificationDeliveryIntents').collect(),
      feed: await ctx.db.query('notificationFeedItems').collect()
    }))
    expect(state.feed).toEqual([])
    expect(
      state.intents.every((intent) => intent.status === 'PENDING' && !intent.providerEmailId)
    ).toBe(true)
  })
})
