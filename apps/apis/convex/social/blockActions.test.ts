import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignInviteDto,
  CampaignDetailDto,
  CreateCampaignInviteInput,
  campaignInviteVersionInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  DecideSocialApplicationInput,
  SocialApplicationDto,
  SubmitSocialApplicationInput,
  socialApplicationVersionInputSchema,
  socialBlockInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import type { NotificationIntentData } from '@artificer-toolkit/schema/api/notifications'
import type {
  SocialAdmissionListInput,
  SocialApplicationPage,
  SocialInvitationListInput,
  SocialInvitationPage,
  SocialListingAdmissionListInput,
  SocialListingInvitationListInput
} from '@artificer-toolkit/schema/api/socialAdmissionLists'
import { fixture } from '../../tests/fixtures/socialWriters'
import { isNotificationSourceEligible } from '../notifications/source'

const submit = makeFunctionReference<
  'mutation',
  SubmitSocialApplicationInput,
  SocialApplicationDto
>('social/applications:submit')
const decide = makeFunctionReference<
  'mutation',
  DecideSocialApplicationInput,
  SocialApplicationDto
>('social/applications:decide')
const withdraw = makeFunctionReference<
  'mutation',
  z.input<typeof socialApplicationVersionInputSchema>,
  SocialApplicationDto
>('social/applications:withdraw')
const invite = makeFunctionReference<'mutation', CreateCampaignInviteInput, CampaignInviteDto>(
  'social/invitations:create'
)
const decline = makeFunctionReference<
  'mutation',
  z.input<typeof campaignInviteVersionInputSchema>,
  CampaignInviteDto
>('social/invitations:decline')
const revoke = makeFunctionReference<
  'mutation',
  z.input<typeof campaignInviteVersionInputSchema>,
  null
>('social/invitations:revoke')
const acceptInvite = makeFunctionReference<
  'mutation',
  z.input<typeof campaignInviteVersionInputSchema>,
  CampaignDetailDto
>('social/invitations:accept')
const createBlock = makeFunctionReference<
  'mutation',
  z.input<typeof socialBlockInputSchema>,
  unknown
>('social/blocks:create')
const removeBlock = makeFunctionReference<'mutation', z.input<typeof socialBlockInputSchema>, null>(
  'social/blocks:remove'
)
const ownApplications = makeFunctionReference<
  'query',
  SocialAdmissionListInput,
  SocialApplicationPage
>('social/admissionLists:listOwnApplications')
const listingApplications = makeFunctionReference<
  'query',
  SocialListingAdmissionListInput,
  SocialApplicationPage
>('social/admissionLists:listListingApplications')
const receivedInvitations = makeFunctionReference<
  'query',
  SocialInvitationListInput,
  SocialInvitationPage
>('social/admissionLists:listReceivedInvitations')
const listingInvitations = makeFunctionReference<
  'query',
  SocialListingInvitationListInput,
  SocialInvitationPage
>('social/admissionLists:listListingInvitations')

const page = (group: 'PENDING' | 'HISTORY'): SocialAdmissionListInput => ({
  group,
  paginationOpts: { cursor: null, numItems: 10 }
})

const invitationPage = (group: 'PENDING' | 'HISTORY'): SocialInvitationListInput => ({
  ...page(group),
  asOf: new Date().toISOString()
})

describe('native Social block actions', () => {
  it('permanently invalidates pending admission sources across unblock, replacement, and cleanup', async () => {
    vi.useFakeTimers()
    try {
      const base = await fixture()
      const application = await base.other.caller.mutation(submit, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        message: 'Old application'
      })
      const invitation = await base.owner.caller.mutation(invite, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        username: 'AdmissionPlayer'
      })
      const [owner, player] = await base.t.run(async (ctx) =>
        Promise.all([
          ctx.db
            .query('socialProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
            .unique(),
          ctx.db
            .query('socialProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
            .unique()
        ])
      )
      if (!owner || !player) throw new Error('Missing Social profiles.')

      await base.owner.caller.mutation(createBlock, { profilePublicId: player.id })
      await base.owner.caller.mutation(removeBlock, { profilePublicId: player.id })

      expect((await base.other.caller.query(ownApplications, page('PENDING'))).page).toEqual([])
      expect(
        (
          await base.owner.caller.query(listingApplications, {
            ...page('PENDING'),
            listingPublicId: base.listing.listingPublicId
          })
        ).page
      ).toEqual([])
      expect(
        (await base.other.caller.query(receivedInvitations, invitationPage('PENDING'))).page
      ).toEqual([])
      expect(
        (
          await base.owner.caller.query(listingInvitations, {
            ...invitationPage('PENDING'),
            listingPublicId: base.listing.listingPublicId
          })
        ).page
      ).toEqual([])

      expect((await base.other.caller.query(ownApplications, page('HISTORY'))).page).toMatchObject([
        { applicationPublicId: application.applicationPublicId, status: 'BLOCKED', version: 1 }
      ])
      expect(
        (
          await base.owner.caller.query(listingApplications, {
            ...page('HISTORY'),
            listingPublicId: base.listing.listingPublicId
          })
        ).page
      ).toMatchObject([
        { applicationPublicId: application.applicationPublicId, status: 'BLOCKED', version: 1 }
      ])
      expect(
        (await base.other.caller.query(receivedInvitations, invitationPage('HISTORY'))).page
      ).toMatchObject([
        { invitePublicId: invitation.invitePublicId, status: 'REVOKED', version: 1 }
      ])
      expect(
        (
          await base.owner.caller.query(listingInvitations, {
            ...invitationPage('HISTORY'),
            listingPublicId: base.listing.listingPublicId
          })
        ).page
      ).toMatchObject([
        { invitePublicId: invitation.invitePublicId, status: 'REVOKED', version: 1 }
      ])

      for (const expectedVersion of [application.version, application.version + 1]) {
        await expect(
          base.owner.caller.mutation(decide, {
            applicationPublicId: application.applicationPublicId,
            expectedVersion,
            decision: 'ACCEPT'
          })
        ).rejects.toThrow()
        await expect(
          base.owner.caller.mutation(decide, {
            applicationPublicId: application.applicationPublicId,
            expectedVersion,
            decision: 'DECLINE'
          })
        ).rejects.toThrow()
        await expect(
          base.other.caller.mutation(withdraw, {
            applicationPublicId: application.applicationPublicId,
            expectedVersion
          })
        ).rejects.toThrow()
        await expect(
          base.other.caller.mutation(acceptInvite, {
            invitePublicId: invitation.invitePublicId,
            expectedVersion
          })
        ).rejects.toThrow()
      }
      for (const expectedVersion of [invitation.version, invitation.version + 1]) {
        await expect(
          base.other.caller.mutation(decline, {
            invitePublicId: invitation.invitePublicId,
            expectedVersion
          })
        ).rejects.toThrow()
        await expect(
          base.owner.caller.mutation(revoke, {
            invitePublicId: invitation.invitePublicId,
            expectedVersion
          })
        ).rejects.toThrow()
      }

      const oldIntents = await base.t.run((ctx) =>
        ctx.db.query('notificationDeliveryIntents').collect()
      )
      for (const intent of oldIntents.filter((row) =>
        [application.applicationPublicId, invitation.invitePublicId].includes(row.sourcePublicId)
      )) {
        expect(
          await base.t.run((ctx) =>
            isNotificationSourceEligible(
              ctx,
              intent.recipientUserId,
              intent.data as NotificationIntentData
            )
          )
        ).toBe(false)
      }

      const replacementApplication = await base.other.caller.mutation(submit, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        message: 'Replacement application'
      })
      const replacementInvitation = await base.owner.caller.mutation(invite, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        username: 'AdmissionPlayer'
      })
      expect(replacementApplication).toMatchObject({ status: 'SUBMITTED', version: 0 })
      expect(replacementInvitation).toMatchObject({ status: 'PENDING', version: 0 })
      expect(
        await base.t.run(async (ctx) =>
          Promise.all([
            ctx.db
              .query('socialApplications')
              .withIndex('by_publicId', (q) =>
                q.eq('id', replacementApplication.applicationPublicId)
              )
              .unique(),
            ctx.db
              .query('campaignInvites')
              .withIndex('by_publicId', (q) => q.eq('id', replacementInvitation.invitePublicId))
              .unique()
          ])
        )
      ).toMatchObject([
        { blockGeneration: 1, status: 'SUBMITTED', version: 0 },
        { blockGeneration: 1, status: 'PENDING', version: 0 }
      ])

      await base.t.finishAllScheduledFunctions(vi.runAllTimers)
      const rows = await base.snapshot()
      expect(
        rows.applications.filter((row) => row.id === application.applicationPublicId)
      ).toHaveLength(1)
      expect(rows.invitations.filter((row) => row.id === invitation.invitePublicId)).toHaveLength(1)
      expect(
        rows.applications.find((row) => row.id === application.applicationPublicId)
      ).toMatchObject({ status: 'BLOCKED', version: 1 })
      expect(rows.invitations.find((row) => row.id === invitation.invitePublicId)).toMatchObject({
        status: 'REVOKED',
        version: 1
      })
      expect(
        rows.applications.find((row) => row.id === replacementApplication.applicationPublicId)
      ).toMatchObject({ status: 'SUBMITTED', version: 0, blockGeneration: 1 })
      expect(
        rows.invitations.find((row) => row.id === replacementInvitation.invitePublicId)
      ).toMatchObject({ status: 'PENDING', version: 0, blockGeneration: 1 })
    } finally {
      vi.useRealTimers()
    }
  })

  it('preserves accepted membership and replay state through block and unblock', async () => {
    vi.useFakeTimers()
    try {
      const base = await fixture()
      const application = await base.other.caller.mutation(submit, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        message: 'Accepted application'
      })
      await base.owner.caller.mutation(decide, {
        applicationPublicId: application.applicationPublicId,
        expectedVersion: application.version,
        decision: 'ACCEPT'
      })
      const before = await base.snapshot()
      const player = await base.t.run((ctx) =>
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
      )
      if (!player) throw new Error('Missing player profile.')
      await base.owner.caller.mutation(createBlock, { profilePublicId: player.id })
      await base.owner.caller.mutation(removeBlock, { profilePublicId: player.id })
      const replay = await base.owner.caller.mutation(decide, {
        applicationPublicId: application.applicationPublicId,
        expectedVersion: 999,
        decision: 'ACCEPT'
      })
      await base.t.finishAllScheduledFunctions(vi.runAllTimers)
      const after = await base.snapshot()
      expect(replay).toEqual(expect.objectContaining({ status: 'ACCEPTED' }))
      expect(after.memberships).toEqual(before.memberships)
      expect(after.applications.find((row) => row.id === application.applicationPublicId)).toEqual(
        before.applications.find((row) => row.id === application.applicationPublicId)
      )
      expect(after.notifications).toEqual(before.notifications)
      expect(after.feed).toEqual(before.feed)
    } finally {
      vi.useRealTimers()
    }
  })
})
