import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CreateCampaignInviteInput,
  CampaignInviteDto
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateSocialReportInput,
  SocialBlockDto,
  SocialReportReceiptDto,
  SubmitSocialApplicationInput,
  SocialApplicationDto
} from '@artificer-toolkit/schema/api/socialHub'
import type {
  socialProfileModerationInputSchema,
  SocialModerationEvidenceDto
} from '@artificer-toolkit/schema/api/socialModeration'
import type { z } from 'zod'
import { fixture } from '../../tests/fixtures/socialWriters'
import { readSocialRateLimits } from '../../tests/fixtures/socialRateLimits'
import { components } from '../_generated/api'

type FixtureArgs = {
  ownerUserId: string
  playerUserId: string
  inviteeUserId: string
  moderatorUserId: string
  campaignId: string
}
const age = makeFunctionReference<
  'mutation',
  FixtureArgs,
  { applications: number; invitations: number; reports: number; memberships: number }
>('social/developmentFixtures:ageFixtureRecords')
const remove = makeFunctionReference<'mutation', FixtureArgs, null>(
  'social/developmentFixtures:removeFixtureState'
)
const cleanupComplete = makeFunctionReference<
  'query',
  { observerUserId: string; subjects: Array<{ userId: string; profileId: string }> },
  boolean
>('social/developmentFixtures:accountCleanupComplete')
const assertOwnedCampaignDeletionRestricted = makeFunctionReference<
  'mutation',
  { userId: string },
  null
>('social/developmentFixtures:assertOwnedCampaignDeletionRestricted')
const inspectFixtureState = makeFunctionReference<'query', FixtureArgs, unknown>(
  'social/developmentFixtures:inspectFixtureState'
)
const createReport = makeFunctionReference<
  'mutation',
  { input: CreateSocialReportInput },
  SocialReportReceiptDto
>('social/reports:create')
const moderateProfile = makeFunctionReference<
  'mutation',
  z.input<typeof socialProfileModerationInputSchema>,
  SocialModerationEvidenceDto
>('social/profileModeration:action')
const setRole = makeFunctionReference<
  'mutation',
  { userId: string; role: 'user' | 'superadmin' },
  null
>('authAdmin:setRole')
const openModeration = makeFunctionReference<
  'mutation',
  { reportPublicId: string },
  SocialModerationEvidenceDto
>('social/moderation:open')
const createInvitation = makeFunctionReference<
  'mutation',
  CreateCampaignInviteInput,
  CampaignInviteDto
>('social/invitations:create')
const submit = makeFunctionReference<
  'mutation',
  SubmitSocialApplicationInput,
  SocialApplicationDto
>('social/applications:submit')
const createBlock = makeFunctionReference<'mutation', { profilePublicId: string }, SocialBlockDto>(
  'social/blocks:create'
)
const resetBlockPair = makeFunctionReference<
  'mutation',
  { blockerUserId: string; blockedUserId: string },
  null
>('social/developmentFixtures:resetBlockPair')

async function setup() {
  const base = await fixture()
  const invitee = await base.addActor('FixtureInvitee')
  const moderator = await base.addActor('FixtureModerator')
  const userIds = [base.owner.userId, base.other.userId, invitee.userId, moderator.userId]
  await base.t.run(async (ctx) => {
    for (const [index, userId] of userIds.entries()) {
      const account = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!account) throw new Error('Missing fixture account.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: account.authUserId }],
          update: { email: `draft_${String(index + 1).padStart(12, '0')}@example.invalid` }
        }
      })
    }
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing fixture Campaign.')
    await ctx.db.patch(campaign._id, { name: 'Encounter execution fixture' })
  })
  return {
    base,
    invitee,
    moderator,
    args: {
      ownerUserId: base.owner.userId,
      playerUserId: base.other.userId,
      inviteeUserId: invitee.userId,
      moderatorUserId: moderator.userId,
      campaignId: base.campaign.id
    }
  }
}

describe('development Social fixture guards', () => {
  it('resets the exact fixture block pair without changing profiles or unrelated state', async () => {
    const { base } = await setup()
    const [blockerProfile, blockedProfile] = await base.t.run(async (ctx) => [
      await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique(),
      await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
    ])
    if (!blockerProfile || !blockedProfile) throw new Error('Missing fixture profiles.')
    const unchangedState = () =>
      base.t.run(async (ctx) => ({
        profiles: await Promise.all(
          [base.owner.userId, base.other.userId].map((userId) =>
            ctx.db
              .query('socialProfiles')
              .withIndex('by_userId', (q) => q.eq('userId', userId))
              .unique()
          )
        ),
        campaign: await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
          .unique(),
        listing: await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
          .unique(),
        membership: await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
          )
          .unique()
      }))
    const unchangedBefore = await unchangedState()
    await base.owner.caller.mutation(createBlock, { profilePublicId: blockedProfile.id })
    const [firstProfileId, secondProfileId] = [blockerProfile.id, blockedProfile.id].sort()
    await expect(
      base.t.run(async (ctx) => ({
        block: await ctx.db
          .query('socialBlocks')
          .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
            q.eq('blockerProfileId', blockerProfile.id).eq('blockedProfileId', blockedProfile.id)
          )
          .unique(),
        invalidations: await ctx.db
          .query('socialBlockInvalidations')
          .withIndex('by_firstProfileId_secondProfileId_generation', (q) =>
            q.eq('firstProfileId', firstProfileId!).eq('secondProfileId', secondProfileId!)
          )
          .collect()
      }))
    ).resolves.toMatchObject({
      block: expect.anything(),
      invalidations: [expect.anything()]
    })
    expect(await readSocialRateLimits(base.t, base.owner.userId, 'BLOCK')).toMatchObject([
      { value: 29 }
    ])

    await base.t.mutation(resetBlockPair, {
      blockerUserId: base.owner.userId,
      blockedUserId: base.other.userId
    })

    expect(
      await base.t.run(async (ctx) => ({
        block: await ctx.db
          .query('socialBlocks')
          .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
            q.eq('blockerProfileId', blockerProfile.id).eq('blockedProfileId', blockedProfile.id)
          )
          .unique(),
        invalidations: await ctx.db
          .query('socialBlockInvalidations')
          .withIndex('by_firstProfileId_secondProfileId_generation', (q) =>
            q.eq('firstProfileId', firstProfileId!).eq('secondProfileId', secondProfileId!)
          )
          .collect()
      }))
    ).toEqual({ block: null, invalidations: [] })
    expect(await readSocialRateLimits(base.t, base.owner.userId, 'BLOCK')).toEqual([
      { value: 30, ts: 0 }
    ])
    expect(await unchangedState()).toEqual(unchangedBefore)
  }, 30_000)

  it('rejects both aging and removal atomically when a foreign moderator views a fixture report', async () => {
    const { base, invitee, args } = await setup()
    const foreignModerator = await base.addActor('ForeignAuditModerator')
    const target = await base.t.run((ctx) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', invitee.userId))
        .unique()
    )
    if (!target) throw new Error('Missing fixture target.')
    const report = await base.owner.caller.mutation(createReport, {
      input: {
        targetKind: 'PROFILE',
        targetPublicId: target.id,
        reason: 'OTHER',
        details: 'Fixture report with a foreign moderator view.'
      }
    })
    await base.t.mutation(setRole, { userId: foreignModerator.userId, role: 'superadmin' })
    await foreignModerator.caller.mutation(openModeration, {
      reportPublicId: report.reportPublicId
    })
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        report: await ctx.db
          .query('socialReports')
          .withIndex('by_publicId', (q) => q.eq('id', report.reportPublicId))
          .unique(),
        audits: await ctx.db
          .query('socialModerationActions')
          .withIndex('by_reportId_createdAt_id', (q) => q.eq('reportId', report.reportPublicId))
          .take(8),
        listing: await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
          .unique(),
        jobs: await ctx.db.system.query('_scheduled_functions').take(8)
      }))
    const before = await snapshot()
    await expect(base.t.mutation(age, args)).rejects.toThrow(
      'Fixture Social audit ownership mismatch.'
    )
    expect(await snapshot()).toEqual(before)
    await expect(base.t.mutation(remove, args)).rejects.toThrow(
      'Fixture Social audit ownership mismatch.'
    )
    expect(await snapshot()).toEqual(before)
  })

  it('proves the owned Campaign restriction without changing account or Campaign state', async () => {
    const { base, args } = await setup()
    const account = await base.t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', args.ownerUserId))
        .unique()
    )
    if (!account) throw new Error('Missing fixture owner account.')
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        account: await ctx.db.get(account._id),
        authUser: await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: 'user',
          where: [{ field: '_id', value: account.authUserId }]
        }),
        campaign: await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', args.campaignId))
          .unique(),
        jobs: await ctx.db.system.query('_scheduled_functions').take(8)
      }))
    const before = await snapshot()
    await base.t.mutation(assertOwnedCampaignDeletionRestricted, {
      userId: args.ownerUserId
    })
    expect(await snapshot()).toEqual(before)
  })
  it('inspects through a missing fixture report parent with a fixture affected target', async () => {
    const { base, invitee, moderator, args } = await setup()
    const profile = await base.t.run((ctx) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', invitee.userId))
        .unique()
    )
    if (!profile) throw new Error('Missing fixture profile.')
    const report = await base.owner.caller.mutation(createReport, {
      input: {
        targetKind: 'PROFILE',
        targetPublicId: profile.id,
        reason: 'OTHER',
        details: 'Fixture audit parent cleanup interval.'
      }
    })
    await base.t.mutation(setRole, { userId: moderator.userId, role: 'superadmin' })
    await moderator.caller.mutation(moderateProfile, {
      reportPublicId: report.reportPublicId,
      expectedVersion: 0,
      action: 'SUSPEND_PROFILE',
      reason: 'Create fixture affected-profile audit.'
    })
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialReports')
        .withIndex('by_publicId', (q) => q.eq('id', report.reportPublicId))
        .unique()
      if (!row) throw new Error('Missing fixture report.')
      await ctx.db.delete(row._id)
    })
    await expect(base.t.query(inspectFixtureState, args)).resolves.toEqual(
      expect.objectContaining({ auditCount: 1 })
    )
  })

  it('rejects a cohort audit whose parent report remains outside fixture selection', async () => {
    const { base, invitee, moderator, args } = await setup()
    const foreign = await base.addActor('ForeignAuditParent')
    const foreignTarget = await base.addActor('ForeignAuditTarget')
    const [inviteeProfile, foreignProfile] = await base.t.run((ctx) =>
      Promise.all([
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', invitee.userId))
          .unique(),
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', foreignTarget.userId))
          .unique()
      ])
    )
    if (!inviteeProfile || !foreignProfile) throw new Error('Missing audit profiles.')
    const foreignReport = await foreign.caller.mutation(createReport, {
      input: {
        targetKind: 'PROFILE',
        targetPublicId: foreignProfile.id,
        reason: 'OTHER',
        details: 'Foreign parent remains outside fixture selection.'
      }
    })
    await base.t.run((ctx) =>
      ctx.db.insert('socialModerationActions', {
        id: crypto.randomUUID(),
        moderatorUserId: moderator.userId,
        reportId: foreignReport.reportPublicId,
        action: 'SUSPEND_PROFILE',
        affectedProfileId: inviteeProfile.id,
        affectedListingId: null,
        reason: 'Foreign parent audit.',
        beforeState: { reportStatus: 'SUBMITTED', reportVersion: 0, profileStatus: 'ACTIVE' },
        afterState: {
          reportStatus: 'SUBMITTED',
          reportVersion: 0,
          profileStatus: 'SUSPENDED',
          action: 'SUSPEND_PROFILE'
        },
        createdAt: new Date().toISOString()
      })
    )
    await expect(base.t.query(inspectFixtureState, args)).rejects.toThrow(
      'Fixture Social audit ownership mismatch.'
    )
  })

  it('reports incomplete cleanup while subjects survive and proves the Campaign restriction atomically', async () => {
    const { base, moderator, args } = await setup()
    const profiles = await base.t.run(async (ctx) =>
      Promise.all(
        [args.ownerUserId, args.playerUserId].map((userId) =>
          ctx.db
            .query('socialProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .unique()
        )
      )
    )
    if (profiles.some((profile) => profile === null)) throw new Error('Missing fixture subjects.')
    const subjects = profiles.map((profile) => ({
      userId: profile!.userId,
      profileId: profile!.id
    }))
    await expect(
      base.t.query(cleanupComplete, { observerUserId: moderator.userId, subjects })
    ).resolves.toBe(false)
    await expect(
      base.t.query(cleanupComplete, {
        observerUserId: moderator.userId,
        subjects: [subjects[0]!, subjects[0]!]
      })
    ).rejects.toThrow('Unique fixture cleanup subjects are required.')
    await base.t.mutation(assertOwnedCampaignDeletionRestricted, {
      userId: args.ownerUserId
    })
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', args.ownerUserId))
          .unique()
      )
    ).resolves.not.toBeNull()
  })

  it('rejects a foreign listing interaction before aging any fixture records', async () => {
    const { base, args } = await setup()
    const foreign = await base.addActor('ForeignFixtureInteraction')
    const application = await foreign.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Foreign application blocks fixture aging.'
    })
    const before = await base.t.run((ctx) =>
      ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
        .unique()
    )
    await expect(base.t.mutation(age, args)).rejects.toThrow(
      'Fixture Social dependency ownership mismatch.'
    )
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
          .unique()
      )
    ).toEqual(before)
  })

  it('ages terminal Social rows while preserving active memberships', async () => {
    const { base, invitee, args } = await setup()
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: args.campaignId,
        userId: args.playerUserId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    )
    const invitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'FixtureInvitee'
    })
    const application = await invitee.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Terminal fixture application.'
    })
    await base.t.run(async (ctx) => {
      const [invite, app] = await Promise.all([
        ctx.db
          .query('campaignInvites')
          .withIndex('by_publicId', (q) => q.eq('id', invitation.invitePublicId))
          .unique(),
        ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
          .unique()
      ])
      if (!invite || !app) throw new Error('Missing fixture admission.')
      await ctx.db.patch(invite._id, { status: 'EXPIRED', expiredAt: invite.updatedAt })
      await ctx.db.patch(app._id, { status: 'DECLINED', respondedAt: app.updatedAt })
    })
    expect(await base.t.mutation(age, args)).toMatchObject({ applications: 1, invitations: 1 })
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', args.campaignId).eq('userId', args.playerUserId)
          )
          .unique()
      )
    ).toMatchObject({ status: 'ACTIVE', leftAt: null })
  })

  it('removes fixture listing history while retaining invitations and blocks for account cleanup', async () => {
    const { base, invitee, args } = await setup()
    const invitation = await base.owner.caller.mutation(createInvitation, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      username: 'FixtureInvitee'
    })
    const application = await invitee.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Remove this fixture application.'
    })
    const ownerProfile = await base.t.run((ctx) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', args.ownerUserId))
        .unique()
    )
    const inviteeProfile = await base.t.run((ctx) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', args.inviteeUserId))
        .unique()
    )
    if (!ownerProfile || !inviteeProfile) throw new Error('Missing fixture profiles.')
    await base.t.run((ctx) =>
      ctx.db.insert('socialBlocks', {
        blockerProfileId: ownerProfile.id,
        blockedProfileId: inviteeProfile.id,
        createdAt: new Date().toISOString()
      })
    )
    await base.t.mutation(remove, args)
    expect(
      await base.t.run(async (ctx) => ({
        listing: await ctx.db
          .query('socialListings')
          .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
          .unique(),
        application: await ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', application.applicationPublicId))
          .unique(),
        invitation: await ctx.db
          .query('campaignInvites')
          .withIndex('by_publicId', (q) => q.eq('id', invitation.invitePublicId))
          .unique(),
        blocks: await ctx.db
          .query('socialBlocks')
          .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
            q.eq('blockerProfileId', ownerProfile.id).eq('blockedProfileId', inviteeProfile.id)
          )
          .take(1)
      }))
    ).toEqual({
      listing: null,
      application: null,
      invitation: expect.anything(),
      blocks: expect.anything()
    })
  })
})
