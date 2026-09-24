import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  SocialListingDto,
  UpdateSocialListingInput
} from '@artificer-toolkit/schema/api/socialHub'
import { fixture, snapshot } from '../../tests/fixtures/socialAdmission'
import { api } from '../_generated/api'
import { orderedSocialPair } from './blockInvalidation'
import { expireInvitation } from './invitationExpiry'
import * as intents from '../notifications/intents'

const update = makeFunctionReference<
  'mutation',
  { input: UpdateSocialListingInput },
  SocialListingDto
>('social/listings:update')

async function setup() {
  const base = await fixture()
  const invalidatedAt = base.campaign.createdAt
  await base.t.run(async (ctx) => {
    const host = await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    const player = await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
    if (!host || !player) throw new Error('Missing Social profiles.')
    // Block was removed before its scheduled cleanup: physical requests are still pending.
    await ctx.db.insert('socialBlockInvalidations', {
      ...orderedSocialPair(host, player),
      generation: 1,
      invalidatedAt
    })
  })
  const before = await snapshot(base)
  const listing = before.listings[0]!
  const input: UpdateSocialListingInput = {
    listingPublicId: listing.id,
    expectedVersion: listing.version,
    summary: listing.summary,
    audience: listing.audience,
    systemId: listing.systemId,
    playMode: listing.playMode,
    capacity: listing.capacity,
    schedule: listing.schedule,
    location: listing.location,
    expectations: listing.expectations
  }
  return { ...base, before, input, invalidatedAt }
}

describe('block invalidation precedence over admission maintenance', () => {
  it.each(['harmless edit', 'material edit', 'close', 'archive', 'transfer'] as const)(
    'retains blocked/revoked history through %s before cleanup',
    async (transition) => {
      const base = await setup()
      if (transition === 'harmless edit' || transition === 'material edit') {
        await base.owner.caller.mutation(update, {
          input: {
            ...base.input,
            ...(transition === 'harmless edit'
              ? { summary: 'New description' }
              : { audience: 'PRIVATE' as const })
          }
        })
      } else if (transition === 'close') {
        await base.owner.caller.mutation(api.social.listings.close, {
          listingPublicId: base.listingId,
          expectedVersion: base.input.expectedVersion
        })
      } else if (transition === 'archive') {
        await base.owner.caller.mutation(api.campaigns.archive.archive, {
          campaignId: base.campaign.id,
          expectedVersion: base.campaign.version
        })
      } else {
        await base.owner.caller.mutation(api.campaigns.ownership.request, {
          campaignId: base.campaign.id,
          recipientUserId: base.other.userId
        })
        await base.other.caller.mutation(api.campaigns.ownership.accept, {
          campaignId: base.campaign.id
        })
      }
      const after = await snapshot(base)
      expect(after.applications.find((row) => row.id === base.applicationId)).toMatchObject({
        status: 'BLOCKED',
        blockedAt: base.invalidatedAt,
        expiredAt: null,
        version: 3,
        listingVersion: 3
      })
      expect(after.invites.find((row) => row.id === base.inviteId)).toMatchObject({
        status: 'REVOKED',
        revokedAt: base.invalidatedAt,
        expiredAt: null,
        version: 3,
        listingVersion: 3
      })
      expect(after.applications.find((row) => row.id === base.acceptedApplicationId)).toEqual(
        base.before.applications.find((row) => row.id === base.acceptedApplicationId)
      )
      expect(after.invites.find((row) => row.id === base.acceptedInviteId)).toEqual(
        base.before.invites.find((row) => row.id === base.acceptedInviteId)
      )
      expect(
        after.notifications.every(
          (row) => row.status === 'CANCELLED' && row.cancelledAt === base.invalidatedAt
        )
      ).toBe(true)
      if (transition !== 'transfer') expect(after.memberships).toEqual(base.before.memberships)
      const invitation = after.invites.find((row) => row.id === base.inviteId)!
      await base.t.run(async (ctx) => {
        expect(await expireInvitation(ctx, invitation, invitation.expiresAt)).toBe(false)
      })
      expect(await snapshot(base)).toEqual(after)
    }
  )

  it('revokes a due invitation using the block time exactly once', async () => {
    const base = await setup()
    const invitation = base.before.invites.find((row) => row.id === base.inviteId)!
    expect(await base.t.run((ctx) => expireInvitation(ctx, invitation, invitation.expiresAt))).toBe(
      true
    )
    const after = await snapshot(base)
    const revoked = after.invites.find((row) => row.id === base.inviteId)!
    expect(revoked).toMatchObject({
      status: 'REVOKED',
      revokedAt: base.invalidatedAt,
      expiredAt: null,
      version: 3
    })
    expect(await base.t.run((ctx) => expireInvitation(ctx, revoked, invitation.expiresAt))).toBe(
      false
    )
    expect(await snapshot(base)).toEqual(after)
  })

  it.each(['recipient', 'host'] as const)(
    'retains expiry and closure precedence after %s profile deletion',
    async (deleted) => {
      const base = await setup()
      await base.t.run(async (ctx) => {
        const profile = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) =>
            q.eq('userId', deleted === 'host' ? base.owner.userId : base.other.userId)
          )
          .unique()
        if (!profile) throw new Error('Missing profile.')
        await ctx.db.delete(profile._id)
        const invitation = base.before.invites.find((row) => row.id === base.inviteId)!
        await expireInvitation(ctx, invitation, invitation.expiresAt)
      })
      await base.owner.caller.mutation(api.campaigns.archive.archive, {
        campaignId: base.campaign.id,
        expectedVersion: base.campaign.version
      })
      const after = await snapshot(base)
      expect(after.invites.find((row) => row.id === base.inviteId)).toMatchObject({
        status: 'REVOKED',
        revokedAt: base.invalidatedAt,
        version: 3,
        expiredAt: null
      })
      expect(after.applications.find((row) => row.id === base.applicationId)).toMatchObject({
        status: 'BLOCKED',
        blockedAt: base.invalidatedAt,
        version: 3,
        expiredAt: null
      })
    }
  )

  it('rolls back listing changes and invalidation together if cancellation fails', async () => {
    const base = await setup()
    const original = intents.cancelNotification
    const fault = vi
      .spyOn(intents, 'cancelNotification')
      .mockImplementationOnce(async (ctx, input) => {
        await original(ctx, input)
        throw new Error('Injected invalidation cancellation failure')
      })
    try {
      await expect(
        base.owner.caller.mutation(update, {
          input: { ...base.input, summary: 'New description' }
        })
      ).rejects.toThrow('Injected invalidation cancellation failure')
    } finally {
      fault.mockRestore()
    }
    expect(await snapshot(base)).toEqual(base.before)
  })
})
