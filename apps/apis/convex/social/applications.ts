import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialApplicationDtoSchema,
  submitSocialApplicationInputSchema,
  socialApplicationVersionInputSchema,
  decideSocialApplicationInputSchema,
  type SocialApplicationDto
} from '@artificer-toolkit/schema/api/socialHub'
import { socialStoredApplicationSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import { socialApplicationPublicIdInputSchema } from '@artificer-toolkit/schema/api/socialAdmissionLists'
import { query } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { readActiveCampaignMembers } from '../campaigns/authority'
import { cancelNotification, enqueueNotification } from '../notifications/intents'
import { requireSocialViewer, presentSocialProfile } from './visibility'
import { consumeSocialRateLimit } from './rateLimits'
import {
  readAdmissionListing,
  readApplication,
  requireAdmissionPair,
  presentApplication
} from './admissionDocuments'
import { acceptAdmission, notifyApplicationDecision } from './admission'
import { readBlockInvalidation } from './blockInvalidation'
import { readAdmissionInvalidation, applicationInvalidationPatch } from './admissionInvalidation'
import { readListingInvalidation } from './listingInvalidation'

export const getOwn = query({
  args: zodToConvexFields(socialApplicationPublicIdInputSchema.shape),
  returns: zodToConvex(socialApplicationDtoSchema),
  handler: async (ctx, args): Promise<SocialApplicationDto> => {
    const actor = await requireSocialViewer(ctx)
    const input = socialApplicationPublicIdInputSchema.parse(args)
    const value = await readApplication(ctx, input.applicationPublicId)
    if (!value.applicant || value.applicant.userId !== actor.userId)
      throw new Error('Social application not found.')
    await requireAdmissionPair(ctx, value.host, value.applicant)
    return presentApplication(ctx, value, true, actor.contentPreference === 'MATURE')
  }
})

export const submit = mutation({
  args: zodToConvexFields(submitSocialApplicationInputSchema.shape),
  returns: zodToConvex(socialApplicationDtoSchema),
  handler: async (ctx, args): Promise<SocialApplicationDto> => {
    const applicant = await requireSocialViewer(ctx)
    const input = submitSocialApplicationInputSchema.parse(args)
    const value = await readAdmissionListing(ctx, input.listingPublicId)
    const { listing, campaign, host } = value
    await requireAdmissionPair(ctx, host, applicant)
    const { invalidation } = await readBlockInvalidation(ctx, host, applicant)
    const listingInvalidation = await readListingInvalidation(ctx, listing.id, null)
    if (
      campaign.ownerUserId === applicant.userId ||
      campaign.status !== 'ACTIVE' ||
      listing.status !== 'OPEN' ||
      listing.audience !== 'PUBLIC' ||
      listing.moderationStatus !== 'VISIBLE'
    )
      throw new Error('Social listing not found.')
    if (listing.version !== input.expectedListingVersion)
      throw new Error('Social listing version conflict.')
    const members = await readActiveCampaignMembers(ctx, campaign)
    if (members.some((member) => member.userId === applicant.userId))
      throw new Error('You are already a member of this Campaign.')
    if (members.filter((member) => member.role === 'PLAYER').length >= listing.capacity)
      throw new Error('This table no longer has an available seat.')
    for (const status of ['SUBMITTED', 'ACCEPTED'] as const) {
      const existing = await ctx.db
        .query('socialApplications')
        .withIndex('by_listingId_applicantProfileId_status', (q) =>
          q.eq('listingId', listing.id).eq('applicantProfileId', applicant.id).eq('status', status)
        )
        .unique()
      if (existing) {
        const event =
          status === 'SUBMITTED'
            ? await readAdmissionInvalidation(
                ctx,
                host.userId,
                { profileId: applicant.id },
                existing.blockGeneration ?? 0,
                { id: listing.id, generation: existing.listingGeneration ?? 0 },
                existing
              )
            : null
        if (event) {
          const staleAt = event.invalidatedAt
          await ctx.db.patch(existing._id, applicationInvalidationPatch(existing.version, event))
          await cancelNotification(ctx, {
            recipientUserId: host.userId,
            sourcePublicId: existing.id,
            workflowKey: 'social-application-submitted',
            occurredAt: staleAt
          })
        } else throw new Error('You already have an active application for this listing.')
      }
    }
    await consumeSocialRateLimit(ctx, applicant.userId, 'APPLICATION')
    const now = new Date().toISOString()
    const application = socialStoredApplicationSchema.parse({
      id: crypto.randomUUID(),
      listingId: listing.id,
      applicantProfileId: applicant.id,
      message: input.message,
      status: 'SUBMITTED',
      listingVersion: listing.version,
      expectationsSnapshot: listing.expectations,
      submittedAt: now,
      respondedAt: null,
      withdrawnAt: null,
      expiredAt: null,
      blockedAt: null,
      blockGeneration: invalidation?.generation ?? 0,
      listingGeneration: listingInvalidation?.generation ?? 0,
      ownerProfileGeneration: host.invalidationGeneration ?? 0,
      participantProfileGeneration: applicant.invalidationGeneration ?? 0,
      version: 0,
      createdAt: now,
      updatedAt: now
    })
    const rowId = await ctx.db.insert('socialApplications', application)
    await enqueueNotification(ctx, {
      recipientUserId: host.userId,
      data: {
        kind: 'SOCIAL_APPLICATION_SUBMITTED',
        sourcePublicId: application.id,
        listingPublicId: listing.id,
        listingTitle: campaign.name,
        applicantUsername: (await presentSocialProfile(ctx, applicant)).username,
        occurredAt: now
      }
    })
    return presentApplication(
      ctx,
      { ...value, application, applicant, rowId },
      true,
      applicant.contentPreference === 'MATURE'
    )
  }
})

export const withdraw = mutation({
  args: zodToConvexFields(socialApplicationVersionInputSchema.shape),
  returns: zodToConvex(socialApplicationDtoSchema),
  handler: async (ctx, args): Promise<SocialApplicationDto> => {
    const actor = await requireSocialViewer(ctx)
    const input = socialApplicationVersionInputSchema.parse(args)
    const value = await readApplication(ctx, input.applicationPublicId)
    if (!value.applicant || value.applicant.userId !== actor.userId)
      throw new Error('Social application not found.')
    const { application } = value
    if (application.status !== 'SUBMITTED' || application.version !== input.expectedVersion)
      throw new Error('Social application version conflict.')
    const now = new Date(Math.max(Date.now(), Date.parse(application.updatedAt) + 1)).toISOString()
    const updated = {
      ...application,
      status: 'WITHDRAWN' as const,
      withdrawnAt: now,
      updatedAt: now,
      version: application.version + 1
    }
    await ctx.db.replace(value.rowId, updated)
    await cancelNotification(ctx, {
      recipientUserId: value.host.userId,
      sourcePublicId: application.id,
      workflowKey: 'social-application-submitted',
      occurredAt: now
    })
    return presentApplication(
      ctx,
      { ...value, application: updated },
      true,
      actor.contentPreference === 'MATURE'
    )
  }
})

export const decide = mutation({
  args: zodToConvexFields(decideSocialApplicationInputSchema.shape),
  returns: zodToConvex(socialApplicationDtoSchema),
  handler: async (ctx, args): Promise<SocialApplicationDto> => {
    const actor = await requireSocialViewer(ctx)
    const input = decideSocialApplicationInputSchema.parse(args)
    if (input.decision === 'ACCEPT') {
      const value = await acceptAdmission(ctx, actor, {
        kind: 'APPLICATION',
        id: input.applicationPublicId,
        expectedVersion: input.expectedVersion
      })
      if (value.kind !== 'APPLICATION') throw new Error('Social admission source mismatch.')
      return presentApplication(ctx, value, false, true)
    }
    const value = await readApplication(ctx, input.applicationPublicId)
    if (value.campaign.ownerUserId !== actor.userId)
      throw new Error('Social application not found.')
    if (!value.applicant) throw new Error('Social application not found.')
    await requireAdmissionPair(ctx, value.host, value.applicant)
    const { application } = value
    if (application.status !== 'SUBMITTED' || application.version !== input.expectedVersion)
      throw new Error('Social application version conflict.')
    const now = new Date(Math.max(Date.now(), Date.parse(application.updatedAt) + 1)).toISOString()
    const updated = {
      ...application,
      status: 'DECLINED' as const,
      respondedAt: now,
      updatedAt: now,
      version: application.version + 1
    }
    await ctx.db.replace(value.rowId, updated)
    await notifyApplicationDecision(ctx, value, 'DECLINED', now)
    return presentApplication(ctx, { ...value, application: updated }, false, true)
  }
})
