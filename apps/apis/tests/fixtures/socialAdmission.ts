import { makeFunctionReference } from 'convex/server'
import type { CreateCampaignInput } from '@artificer-toolkit/schema/api/campaignCore'
import type { SocialEligibilityDto } from '@artificer-toolkit/schema/api/socialHub'
import { notificationStoredIntentSchema } from '@artificer-toolkit/schema/projections/notificationPersistence'
import {
  socialStoredApplicationSchema,
  socialStoredListingSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture as characterFixture } from './characters'
import { api } from '../../convex/_generated/api'

const initializeSocial = makeFunctionReference<
  'mutation',
  Record<string, never>,
  SocialEligibilityDto
>('social/profiles:initialize')

const campaignInput: CreateCampaignInput = {
  name: 'Social ownership transfer',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

const expectations = {
  contentGuidance: 'Adventure',
  attendancePolicy: 'Tell us',
  allowedContentRules: 'SRD',
  tableConduct: 'Be kind',
  contentBoundaries: 'Discuss together',
  safetyPractices: ['LINES_AND_VEILS'] as const,
  safetyDetails: 'Pause when needed'
}

export async function fixture() {
  const base = await characterFixture()
  await base.owner.caller.mutation(api.account.updateProfile, {
    username: 'TransferOwner',
    bio: null
  })
  await base.other.caller.mutation(api.account.updateProfile, {
    username: 'TransferPlayer',
    bio: null
  })
  await base.owner.caller.mutation(initializeSocial, {})
  await base.other.caller.mutation(initializeSocial, {})
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, campaignInput)
  const now = campaign.createdAt
  const listingId = crypto.randomUUID()
  const applicationId = crypto.randomUUID()
  const acceptedApplicationId = crypto.randomUUID()
  const inviteId = crypto.randomUUID()
  const acceptedInviteId = crypto.randomUUID()
  const expiresAt = new Date(Date.parse(now) + 86_400_000).toISOString()
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: now,
      joinedAt: now,
      leftAt: null
    })
    const playerProfile = await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
    if (!playerProfile) throw new Error('Missing Social profile.')
    await ctx.db.insert(
      'socialListings',
      socialStoredListingSchema.parse({
        id: listingId,
        campaignId: campaign.id,
        ownerUserId: base.owner.userId,
        summary: 'A transfer-safe table',
        audience: 'PUBLIC',
        systemId: srdSystemRecord.id,
        playMode: 'ONLINE',
        capacity: 4,
        schedule: { kind: 'FLEXIBLE', timeZone: 'America/Chicago', summary: 'Flexible' },
        location: null,
        expectations,
        status: 'OPEN',
        moderationStatus: 'VISIBLE',
        publishedAt: now,
        version: 3,
        createdAt: now,
        updatedAt: now
      })
    )
    for (const [id, status] of [
      [applicationId, 'SUBMITTED'],
      [acceptedApplicationId, 'ACCEPTED']
    ] as const)
      await ctx.db.insert(
        'socialApplications',
        socialStoredApplicationSchema.parse({
          id,
          listingId,
          applicantProfileId: playerProfile.id,
          message: 'I would like to join.',
          status,
          listingVersion: 3,
          expectationsSnapshot: expectations,
          submittedAt: now,
          respondedAt: status === 'ACCEPTED' ? now : null,
          withdrawnAt: null,
          expiredAt: null,
          blockedAt: null,
          version: status === 'ACCEPTED' ? 4 : 2,
          createdAt: now,
          updatedAt: now
        })
      )
    for (const [id, status, recipientUserId] of [
      [inviteId, 'PENDING', base.other.userId],
      [acceptedInviteId, 'ACCEPTED', base.owner.userId]
    ] as const)
      await ctx.db.insert(
        'campaignInvites',
        campaignStoredInviteSchema.parse({
          id,
          listingId,
          createdBy: base.owner.userId,
          recipientUserId,
          listingVersion: 3,
          recipientUsername: status === 'ACCEPTED' ? 'TransferOwner' : 'TransferPlayer',
          status,
          expiresAt,
          respondedAt: status === 'ACCEPTED' ? now : null,
          createdAt: now,
          updatedAt: now,
          revokedAt: null,
          expiredAt: null,
          version: status === 'ACCEPTED' ? 4 : 2
        })
      )
    await ctx.db.insert('notificationDeliveryIntents', {
      ...notificationStoredIntentSchema.parse({
        id: crypto.randomUUID(),
        recipientUserId: base.owner.userId,
        workflowKey: 'social-application-submitted',
        sourceKind: 'SOCIAL_APPLICATION',
        sourcePublicId: applicationId,
        groupingKey: listingId,
        data: {
          kind: 'SOCIAL_APPLICATION_SUBMITTED',
          sourcePublicId: applicationId,
          listingPublicId: listingId,
          listingTitle: campaign.name,
          applicantUsername: 'TransferPlayer',
          occurredAt: now
        },
        occurredAt: now,
        status: 'PENDING',
        attemptCount: 0,
        nextAttemptAt: now,
        feedRecorded: false,
        providerEmailId: null,
        dispatchedAt: null,
        cancelledAt: null,
        lastErrorCode: null
      }),
      providerEmailId: null
    })
    await ctx.db.insert('notificationDeliveryIntents', {
      ...notificationStoredIntentSchema.parse({
        id: crypto.randomUUID(),
        recipientUserId: base.other.userId,
        workflowKey: 'social-invitation-received',
        sourceKind: 'CAMPAIGN_INVITE',
        sourcePublicId: inviteId,
        groupingKey: null,
        data: {
          kind: 'SOCIAL_INVITATION_RECEIVED',
          sourcePublicId: inviteId,
          listingPublicId: listingId,
          listingTitle: campaign.name,
          hostUsername: 'TransferOwner',
          expiresAt,
          occurredAt: now
        },
        occurredAt: now,
        status: 'PENDING',
        attemptCount: 0,
        nextAttemptAt: now,
        feedRecorded: false,
        providerEmailId: null,
        dispatchedAt: null,
        cancelledAt: null,
        lastErrorCode: null
      }),
      providerEmailId: null
    })
  })
  return {
    ...base,
    campaign,
    listingId,
    applicationId,
    acceptedApplicationId,
    inviteId,
    acceptedInviteId
  }
}

export async function snapshot(base: Awaited<ReturnType<typeof fixture>>) {
  return base.t.run(async (ctx) => ({
    campaigns: await ctx.db.query('campaigns').collect(),
    memberships: await ctx.db.query('campaignMemberships').collect(),
    listings: await ctx.db.query('socialListings').collect(),
    applications: await ctx.db.query('socialApplications').collect(),
    invites: await ctx.db.query('campaignInvites').collect(),
    notifications: await ctx.db.query('notificationDeliveryIntents').collect(),
    transfers: await ctx.db.query('campaignOwnershipTransfers').collect()
  }))
}
