import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteAccountCompletely } from '../../tests/fixtures/accountDeletion'
import { fixture } from '../../tests/fixtures/socialWriters'
import { api, components, internal } from '../_generated/api'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Social account cascade guards', () => {
  it.each(['ACTIVE', 'ARCHIVED'] as const)(
    'rejects deletion for an owned %s Campaign without changing account or Campaign state',
    async (status) => {
      const base = await fixture()
      if (status === 'ARCHIVED')
        await base.owner.caller.mutation(api.campaigns.archive.archive, {
          campaignId: base.campaign.id,
          expectedVersion: base.campaign.version
        })
      const before = await base.t.run(async (ctx) => {
        const account = await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
        const profile = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
        const campaign = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
          .unique()
        if (!account || !profile || !campaign) throw new Error('Missing deletion source.')
        return {
          authUser: await ctx.runQuery(components.betterAuth.adapter.findOne, {
            model: 'user',
            where: [{ field: '_id', value: account.authUserId }]
          }),
          account,
          profile,
          campaign,
          memberships: await ctx.db
            .query('campaignMemberships')
            .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaign.id))
            .take(8),
          listing: await ctx.db
            .query('socialListings')
            .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
            .unique()
        }
      })
      await expect(
        base.t.mutation(internal.accountDeletion.schedule, {
          authUserId: before.account.authUserId
        })
      ).rejects.toThrow('Account deletion is restricted by owned Campaigns.')
      expect(
        await base.t.run(async (ctx) => ({
          authUser: await ctx.runQuery(components.betterAuth.adapter.findOne, {
            model: 'user',
            where: [{ field: '_id', value: before.account.authUserId }]
          }),
          account: await ctx.db.get(before.account._id),
          profile: await ctx.db.get(before.profile._id),
          campaign: await ctx.db.get(before.campaign._id),
          memberships: await ctx.db
            .query('campaignMemberships')
            .withIndex('by_campaignId_status', (q) => q.eq('campaignId', before.campaign.id))
            .take(8),
          listing: await ctx.db
            .query('socialListings')
            .withIndex('by_campaignId', (q) => q.eq('campaignId', before.campaign.id))
            .unique()
        }))
      ).toEqual(before)
    }
  )

  it('hides former-owner invitations immediately after transfer and removes them through cleanup', async () => {
    const base = await fixture()
    const recipient = await base.addActor('TransferredInvitee')
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    )
    const invitation = await base.owner.caller.mutation(api.social.invitations.create, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'TransferredInvitee'
    })
    await base.owner.caller.mutation(api.campaigns.ownership.request, {
      campaignId: base.campaign.id,
      recipientUserId: base.other.userId
    })
    await base.other.caller.mutation(api.campaigns.ownership.accept, {
      campaignId: base.campaign.id
    })
    const beforeDeletion = await base.t.run(async (ctx) => {
      const account = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      const storedInvitation = await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', invitation.invitePublicId))
        .unique()
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!account || !storedInvitation || !campaign) throw new Error('Missing transfer source.')
      return { account, storedInvitation, campaign }
    })
    expect(beforeDeletion.storedInvitation.createdBy).toBe(base.owner.userId)
    expect(beforeDeletion.campaign.ownerUserId).toBe(base.other.userId)
    await expect(
      recipient.caller.query(api.social.invitationReads.getReceived, {
        invitePublicId: invitation.invitePublicId,
        asOf: new Date().toISOString()
      })
    ).resolves.toMatchObject({ status: 'EXPIRED' })
    await expect(
      base.other.caller.query(api.social.invitationReads.getForListing, {
        listingPublicId: base.listing.listingPublicId,
        invitePublicId: invitation.invitePublicId,
        asOf: new Date().toISOString()
      })
    ).resolves.toMatchObject({ status: 'EXPIRED' })

    await deleteAccountCompletely(base.t, beforeDeletion.account.authUserId)

    await expect(
      recipient.caller.query(api.social.invitationReads.getReceived, {
        invitePublicId: invitation.invitePublicId,
        asOf: new Date().toISOString()
      })
    ).rejects.toThrow('Social invitation not found.')
    await expect(
      base.other.caller.query(api.social.invitationReads.getForListing, {
        listingPublicId: base.listing.listingPublicId,
        invitePublicId: invitation.invitePublicId,
        asOf: new Date().toISOString()
      })
    ).rejects.toThrow('Social invitation not found.')

    expect(
      await base.t.run(async (ctx) => ({
        invitation: await ctx.db
          .query('campaignInvites')
          .withIndex('by_publicId', (q) => q.eq('id', invitation.invitePublicId))
          .unique(),
        campaign: await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
          .unique()
      }))
    ).toEqual({
      invitation: null,
      campaign: expect.objectContaining({ id: base.campaign.id, ownerUserId: base.other.userId })
    })
  })
})
