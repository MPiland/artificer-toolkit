import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignInviteDto,
  CreateCampaignInviteInput,
  campaignInviteVersionInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  DecideSocialApplicationInput,
  SocialApplicationDto,
  SubmitSocialApplicationInput,
  socialApplicationVersionInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { fixture as setup } from '../../tests/fixtures/socialWriters'
import { exhaustSocialRateLimit, readSocialRateLimits } from '../../tests/fixtures/socialRateLimits'
import * as intents from '../notifications/intents'

const submitApplication = makeFunctionReference<
  'mutation',
  SubmitSocialApplicationInput,
  SocialApplicationDto
>('social/applications:submit')
const withdrawApplication = makeFunctionReference<
  'mutation',
  z.input<typeof socialApplicationVersionInputSchema>,
  SocialApplicationDto
>('social/applications:withdraw')
const decideApplication = makeFunctionReference<
  'mutation',
  DecideSocialApplicationInput,
  SocialApplicationDto
>('social/applications:decide')
const createInvitation = makeFunctionReference<
  'mutation',
  CreateCampaignInviteInput,
  CampaignInviteDto
>('social/invitations:create')
const declineInvitation = makeFunctionReference<
  'mutation',
  z.input<typeof campaignInviteVersionInputSchema>,
  CampaignInviteDto
>('social/invitations:decline')
const revokeInvitation = makeFunctionReference<
  'mutation',
  z.input<typeof campaignInviteVersionInputSchema>,
  null
>('social/invitations:revoke')

describe('native Social admission source writers', () => {
  it('submits a public application with normalized ids, immutable expectations, private text, and safe notification data', async () => {
    const base = await setup()
    const result = await base.other.caller.mutation(submitApplication, {
      listingPublicId: base.listing.listingPublicId.toUpperCase(),
      message: 'A shitstorm message',
      expectedListingVersion: base.listing.version
    })

    expect(result).toMatchObject({
      applicationPublicId: result.applicationPublicId.toLowerCase(),
      listingPublicId: base.listing.listingPublicId,
      listingTitle: 'A ****storm campaign',
      message: 'A shitstorm message',
      status: 'SUBMITTED',
      listingVersion: base.listing.version,
      expectations: { contentGuidance: 'A ****storm of adventure' }
    })
    const state = await base.snapshot()
    const notification = state.notifications.find(
      (row) => row.sourcePublicId === result.applicationPublicId
    )
    expect(notification).toMatchObject({
      recipientUserId: base.owner.userId,
      workflowKey: 'social-application-submitted',
      data: {
        kind: 'SOCIAL_APPLICATION_SUBMITTED',
        sourcePublicId: result.applicationPublicId,
        listingPublicId: base.listing.listingPublicId,
        applicantUsername: 'AdmissionPlayer'
      }
    })
    expect(notification?.data).not.toHaveProperty('message')
    expect(notification?.data).not.toHaveProperty('email')

    await base.t.run(async (ctx) => {
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
        .unique()
      if (!listing) throw new Error('Missing listing')
      await ctx.db.patch(listing._id, {
        expectations: { ...listing.expectations, contentGuidance: 'Changed later' }
      })
    })
    const finalState = await base.snapshot()
    expect(
      finalState.applications.find((row) => row.id === result.applicationPublicId)
        ?.expectationsSnapshot.contentGuidance
    ).toBe('A shitstorm of adventure')
  })

  it('declines an application with host-facing Standard masking and recipient decision notification', async () => {
    const base = await setup()
    const submitted = await base.other.caller.mutation(submitApplication, {
      listingPublicId: base.listing.listingPublicId,
      message: 'A shitstorm message',
      expectedListingVersion: base.listing.version
    })
    const result = await base.owner.caller.mutation(decideApplication, {
      applicationPublicId: submitted.applicationPublicId.toUpperCase(),
      expectedVersion: submitted.version,
      decision: 'DECLINE'
    })
    expect(result).toMatchObject({ status: 'DECLINED', message: 'A ****storm message' })
    const state = await base.snapshot()
    expect(state.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: base.other.userId,
          workflowKey: 'social-application-decided',
          data: expect.objectContaining({ decision: 'DECLINED' })
        }),
        expect.objectContaining({
          recipientUserId: base.owner.userId,
          workflowKey: 'social-application-submitted',
          status: 'CANCELLED'
        })
      ])
    )
  })

  it('withdraws only the applicant application and cancels its notification', async () => {
    const base = await setup()
    const submitted = await base.other.caller.mutation(submitApplication, {
      listingPublicId: base.listing.listingPublicId,
      message: 'Please join',
      expectedListingVersion: base.listing.version
    })
    await expect(
      base.other.caller.mutation(withdrawApplication, {
        applicationPublicId: submitted.applicationPublicId,
        expectedVersion: submitted.version
      })
    ).resolves.toMatchObject({ status: 'WITHDRAWN', version: submitted.version + 1 })
    await expect(
      base.other.caller.mutation(withdrawApplication, {
        applicationPublicId: submitted.applicationPublicId,
        expectedVersion: submitted.version
      })
    ).rejects.toThrow('version conflict')
    await expect(
      base.owner.caller.mutation(withdrawApplication, {
        applicationPublicId: submitted.applicationPublicId,
        expectedVersion: submitted.version + 1
      })
    ).rejects.toThrow('not found')
    const state = await base.snapshot()
    expect(state.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePublicId: submitted.applicationPublicId,
          status: 'CANCELLED'
        })
      ])
    )
  })

  it('creates invitations through case-insensitive username lookup and presents Standard titles masked', async () => {
    const base = await setup()
    const result = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId.toUpperCase(),
      expectedListingVersion: base.listing.version,
      username: ' admissionplayer '
    })
    expect(result).toMatchObject({
      invitePublicId: result.invitePublicId.toLowerCase(),
      listingPublicId: base.listing.listingPublicId,
      listingTitle: 'A ****storm campaign',
      hostUsername: 'AdmissionHost',
      recipientUsername: 'AdmissionPlayer',
      status: 'PENDING',
      version: 0
    })
    const state = await base.snapshot()
    expect(state.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: base.other.userId,
          workflowKey: 'social-invitation-received',
          data: expect.objectContaining({
            kind: 'SOCIAL_INVITATION_RECEIVED',
            sourcePublicId: result.invitePublicId,
            hostUsername: 'AdmissionHost'
          })
        })
      ])
    )
  })

  it('declines an invitation as recipient and revokes one as owner with optimistic versions', async () => {
    const base = await setup()
    const invitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    await expect(
      base.other.caller.mutation(declineInvitation, {
        invitePublicId: invitation.invitePublicId,
        expectedVersion: invitation.version
      })
    ).resolves.toMatchObject({ status: 'DECLINED', version: 1 })

    const second = await setup()
    const pending = await second.owner.caller.mutation(createInvitation, {
      listingPublicId: second.listing.listingPublicId,
      expectedListingVersion: second.listing.version,
      username: 'AdmissionPlayer'
    })
    await expect(
      second.owner.caller.mutation(revokeInvitation, {
        invitePublicId: pending.invitePublicId,
        expectedVersion: pending.version
      })
    ).resolves.toBeNull()
    await expect(
      second.owner.caller.mutation(revokeInvitation, {
        invitePublicId: pending.invitePublicId,
        expectedVersion: pending.version
      })
    ).rejects.toThrow('version conflict')
  })

  it('rejects hidden, closed, archived, private, owner-self, and outsider source mutations', async () => {
    const base = await setup()
    await expect(
      base.t.mutation(submitApplication, {
        listingPublicId: base.listing.listingPublicId,
        message: 'Nope',
        expectedListingVersion: base.listing.version
      })
    ).rejects.toThrow()
    await expect(
      base.owner.caller.mutation(submitApplication, {
        listingPublicId: base.listing.listingPublicId,
        message: 'Nope',
        expectedListingVersion: base.listing.version
      })
    ).rejects.toThrow('Social listing not found')
    await expect(
      base.other.caller.mutation(createInvitation, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        username: 'AdmissionHost'
      })
    ).rejects.toThrow('Social listing not found')

    for (const state of [
      { audience: 'PRIVATE', status: 'OPEN', moderationStatus: 'VISIBLE' },
      { audience: 'PUBLIC', status: 'CLOSED', moderationStatus: 'VISIBLE' },
      { audience: 'PUBLIC', status: 'OPEN', moderationStatus: 'HIDDEN' }
    ] as const) {
      await base.t.run(async (ctx) => {
        const listing = await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
          .unique()
        if (!listing) throw new Error('Missing listing')
        await ctx.db.patch(listing._id, state)
      })
      const before = await base.snapshot()
      await expect(
        base.other.caller.mutation(submitApplication, {
          listingPublicId: base.listing.listingPublicId,
          message: 'Nope',
          expectedListingVersion: base.listing.version
        })
      ).rejects.toThrow('Social listing not found')
      expect(await base.snapshot()).toEqual(before)
    }

    const suspended = await setup()
    await suspended.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', suspended.other.userId))
        .unique()
      if (!profile) throw new Error('Missing profile')
      await ctx.db.patch(profile._id, { status: 'SUSPENDED' })
    })
    await expect(
      suspended.other.caller.mutation(submitApplication, {
        listingPublicId: suspended.listing.listingPublicId,
        message: 'Nope',
        expectedListingVersion: suspended.listing.version
      })
    ).rejects.toThrow('active Social profile')

    const missingProfile = await setup()
    await missingProfile.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', missingProfile.other.userId))
        .unique()
      if (!profile) throw new Error('Missing profile')
      await ctx.db.delete(profile._id)
    })
    await expect(
      missingProfile.other.caller.mutation(submitApplication, {
        listingPublicId: missingProfile.listing.listingPublicId,
        message: 'Nope',
        expectedListingVersion: missingProfile.listing.version
      })
    ).rejects.toThrow('active Social profile')

    const archived = await setup()
    await archived.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', archived.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing campaign')
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
    })
    await expect(
      archived.other.caller.mutation(submitApplication, {
        listingPublicId: archived.listing.listingPublicId,
        message: 'Nope',
        expectedListingVersion: archived.listing.version
      })
    ).rejects.toThrow('Social listing not found')
  })

  it('prevents duplicate active applications and pending invitations while rolling back rate counters on failure', async () => {
    const base = await setup()
    const submitted = await base.other.caller.mutation(submitApplication, {
      listingPublicId: base.listing.listingPublicId,
      message: 'First',
      expectedListingVersion: base.listing.version
    })
    const afterFirst = await readSocialRateLimits(base.t, base.other.userId, 'APPLICATION')
    await expect(
      base.other.caller.mutation(submitApplication, {
        listingPublicId: base.listing.listingPublicId,
        message: 'Duplicate',
        expectedListingVersion: base.listing.version
      })
    ).rejects.toThrow('active application')
    expect(await readSocialRateLimits(base.t, base.other.userId, 'APPLICATION')).toEqual(afterFirst)
    expect(submitted.status).toBe('SUBMITTED')

    const invitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    const beforeInviteDuplicate = await readSocialRateLimits(base.t, base.owner.userId, 'INVITE')
    await expect(
      base.owner.caller.mutation(createInvitation, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        username: 'ADMISSIONPLAYER'
      })
    ).rejects.toThrow('pending invitation')
    expect(await readSocialRateLimits(base.t, base.owner.userId, 'INVITE')).toEqual(
      beforeInviteDuplicate
    )
    expect(invitation.status).toBe('PENDING')
  })

  it('uses default seven-day and bounded invitation expiries', async () => {
    const base = await setup()
    const now = Date.now()
    const invitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'AdmissionPlayer'
    })
    expect(Date.parse(invitation.expiresAt)).toBeGreaterThan(now + 6 * 86_400_000)
    expect(Date.parse(invitation.expiresAt)).toBeLessThan(now + 8 * 86_400_000)

    const second = await setup()
    for (const expiresAt of [
      new Date(Date.now() - 1).toISOString(),
      new Date(Date.now() + 31 * 86_400_000).toISOString()
    ]) {
      await expect(
        second.owner.caller.mutation(createInvitation, {
          listingPublicId: second.listing.listingPublicId,
          expectedListingVersion: second.listing.version,
          username: 'AdmissionPlayer',
          expiresAt
        })
      ).rejects.toThrow('within the next 30 days')
    }
    await expect(
      second.owner.caller.mutation(createInvitation, {
        listingPublicId: second.listing.listingPublicId,
        expectedListingVersion: second.listing.version,
        username: 'AdmissionPlayer',
        expiresAt: 'not-a-timestamp'
      })
    ).rejects.toThrow('Invalid ISO datetime')
  })

  it('keeps accepted applications unique after the admitted player departs', async () => {
    const base = await setup()
    const submitted = await base.other.caller.mutation(submitApplication, {
      listingPublicId: base.listing.listingPublicId,
      message: 'First',
      expectedListingVersion: base.listing.version
    })
    await base.owner.caller.mutation(decideApplication, {
      applicationPublicId: submitted.applicationPublicId,
      expectedVersion: submitted.version,
      decision: 'ACCEPT'
    })
    await base.t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
        )
        .unique()
      if (!member) throw new Error('Missing member.')
      await ctx.db.patch(member._id, { status: 'LEFT', leftAt: member.accessStartedAt })
    })
    const before = await base.snapshot()
    await expect(
      base.other.caller.mutation(submitApplication, {
        listingPublicId: base.listing.listingPublicId,
        message: 'Duplicate',
        expectedListingVersion: base.listing.version
      })
    ).rejects.toThrow('active application')
    expect(await base.snapshot()).toEqual(before)
  })

  it.each(['APPLICATION', 'INVITE'] as const)(
    'enforces the %s rate boundary and rolls back all counters and source writes',
    async (action) => {
      const base = await setup()
      const actor = action === 'APPLICATION' ? base.other : base.owner
      await exhaustSocialRateLimit(base.t, actor.userId, action)
      const before = await base.snapshot()
      const limitsBefore = await readSocialRateLimits(base.t, actor.userId, action)
      const command =
        action === 'APPLICATION'
          ? actor.caller.mutation(submitApplication, {
              listingPublicId: base.listing.listingPublicId,
              message: 'Over limit',
              expectedListingVersion: base.listing.version
            })
          : actor.caller.mutation(createInvitation, {
              listingPublicId: base.listing.listingPublicId,
              expectedListingVersion: base.listing.version,
              username: 'AdmissionPlayer'
            })
      await expect(command).rejects.toThrow('Too many Social actions')
      expect(await base.snapshot()).toEqual(before)
      expect(await readSocialRateLimits(base.t, actor.userId, action)).toEqual(limitsBefore)
    }
  )

  it('rolls back source writes when notification enqueue or cancellation fails', async () => {
    const base = await setup()
    const before = await base.snapshot()
    const enqueueFault = vi
      .spyOn(intents, 'enqueueNotification')
      .mockImplementationOnce(async () => {
        throw new Error('Injected enqueue failure')
      })
    try {
      await expect(
        base.other.caller.mutation(submitApplication, {
          listingPublicId: base.listing.listingPublicId,
          message: 'Rollback',
          expectedListingVersion: base.listing.version
        })
      ).rejects.toThrow('Injected enqueue failure')
    } finally {
      enqueueFault.mockRestore()
    }
    expect(await base.snapshot()).toEqual(before)

    const submitted = await base.other.caller.mutation(submitApplication, {
      listingPublicId: base.listing.listingPublicId,
      message: 'Cancel rollback',
      expectedListingVersion: base.listing.version
    })
    const beforeWithdraw = await base.snapshot()
    const cancelFault = vi.spyOn(intents, 'cancelNotification').mockImplementationOnce(async () => {
      throw new Error('Injected cancellation failure')
    })
    try {
      await expect(
        base.other.caller.mutation(withdrawApplication, {
          applicationPublicId: submitted.applicationPublicId,
          expectedVersion: submitted.version
        })
      ).rejects.toThrow('Injected cancellation failure')
    } finally {
      cancelFault.mockRestore()
    }
    expect(await base.snapshot()).toEqual(beforeWithdraw)
  })
})
