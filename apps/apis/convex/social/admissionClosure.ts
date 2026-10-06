import {
  socialStoredListingSchema,
  socialStoredApplicationSchema,
  type SocialStoredListing
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { cancelNotification } from '../notifications/intents'
import { syncAccountUsage } from '../lib/accountUsage'
import {
  readAdmissionInvalidation,
  applicationInvalidationPatch,
  invitationInvalidationPatch
} from './admissionInvalidation'
import { resolveListingSuspension } from './profileInvalidation'
import { readProfile } from './profiles'
import { readListingInvalidation } from './listingInvalidation'

/** Close admission using the pre-transition owner for notification cancellation. */
export async function closeCampaignAdmission(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  nextOwnerUserId: string,
  now: string,
  deferReconciliation = false
) {
  const row = await ctx.db
    .query('socialListings')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .unique()
  if (!row) return
  const { _id, _creationTime, ...stored } = row
  const listing = await resolveListingSuspension(ctx, socialStoredListingSchema.parse(stored))
  if (listing.ownerUserId !== campaign.ownerUserId)
    throw new Error('Stored Social listing ownership mismatch.')
  await ctx.db.patch(_id, {
    status: 'CLOSED',
    ownerUserId: nextOwnerUserId,
    ownerProfileGeneration:
      nextOwnerUserId === listing.ownerUserId
        ? (listing.ownerProfileGeneration ?? 0)
        : ((await readProfile(ctx, nextOwnerUserId))?.profile.invalidationGeneration ?? 0),
    version: listing.status === 'CLOSED' ? listing.version : listing.version + 1,
    updatedAt: now
  })
  await syncAccountUsage(ctx, 'publicListings', listing.id)
  if (deferReconciliation) {
    const latest = await readListingInvalidation(ctx, listing.id, null)
    await ctx.db.insert('socialListingInvalidations', {
      listingId: listing.id,
      generation: (latest?.generation ?? 0) + 1,
      invalidatedAt: now,
      committedAt: ctx.db.vars.commitTs
    })
  } else await reconcileListingAdmission(ctx, listing, now, null)
}

/** Null expires pending admission; a version refresh keeps its decision valid after a harmless edit. */
export async function reconcileListingAdmission(
  ctx: MutationCtx,
  listing: Pick<SocialStoredListing, 'id' | 'ownerUserId'>,
  now: string,
  listingVersion: number | null,
  pageSize?: number
) {
  let processed = 0
  const applications = ctx.db
    .query('socialApplications')
    .withIndex('by_listingId_status', (q) =>
      q.eq('listingId', listing.id).eq('status', 'SUBMITTED')
    )
  for await (const application of pageSize === undefined
    ? applications
    : await applications.take(pageSize)) {
    processed++
    const { _id, _creationTime, ...stored } = application
    socialStoredApplicationSchema.parse(stored)
    const invalidation = await readAdmissionInvalidation(
      ctx,
      listing.ownerUserId,
      {
        profileId: application.applicantProfileId
      },
      application.blockGeneration ?? 0,
      { id: listing.id, generation: application.listingGeneration ?? 0 },
      application
    )
    const occurredAt = invalidation ? invalidation.invalidatedAt : now
    await ctx.db.patch(application._id, {
      ...(invalidation
        ? applicationInvalidationPatch(application.version, invalidation)
        : listingVersion === null
          ? { status: 'EXPIRED' as const, expiredAt: now }
          : { listingVersion }),
      updatedAt: now,
      version: application.version + 1
    })
    if (invalidation || listingVersion === null)
      await cancelNotification(ctx, {
        recipientUserId: listing.ownerUserId,
        sourcePublicId: application.id,
        workflowKey: 'social-application-submitted',
        occurredAt
      })
  }
  const invites = ctx.db
    .query('campaignInvites')
    .withIndex('by_listingId_status', (q) => q.eq('listingId', listing.id).eq('status', 'PENDING'))
  for await (const invite of pageSize === undefined ? invites : await invites.take(pageSize)) {
    processed++
    const { _id, _creationTime, ...stored } = invite
    campaignStoredInviteSchema.parse(stored)
    const invalidation = await readAdmissionInvalidation(
      ctx,
      listing.ownerUserId,
      {
        userId: invite.recipientUserId
      },
      invite.blockGeneration ?? 0,
      { id: listing.id, generation: invite.listingGeneration ?? 0 },
      invite
    )
    const occurredAt = invalidation ? invalidation.invalidatedAt : now
    await ctx.db.patch(invite._id, {
      ...(invalidation
        ? invitationInvalidationPatch(invite.version, invalidation)
        : listingVersion === null
          ? { status: 'EXPIRED' as const, expiredAt: now }
          : { listingVersion }),
      updatedAt: now,
      version: invite.version + 1
    })
    if (invalidation || listingVersion === null)
      await cancelNotification(ctx, {
        recipientUserId: invite.recipientUserId,
        sourcePublicId: invite.id,
        workflowKey: 'social-invitation-received',
        occurredAt
      })
  }
  return processed === 0
}
