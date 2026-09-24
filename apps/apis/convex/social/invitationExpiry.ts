import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { cancelNotification } from '../notifications/intents'
import { readAdmissionInvalidation, invitationInvalidationPatch } from './admissionInvalidation'

export async function expireInvitation(ctx: MutationCtx, row: Doc<'campaignInvites'>, now: string) {
  const { _id, _creationTime, ...stored } = row
  const invitation = campaignStoredInviteSchema.parse(stored)
  if (invitation.status !== 'PENDING' || Date.parse(invitation.expiresAt) > Date.parse(now))
    return false
  const listing = await ctx.db
    .query('socialListings')
    .withIndex('by_publicId', (q) => q.eq('id', invitation.listingId))
    .unique()
  const invalidation = listing
    ? await readAdmissionInvalidation(
        ctx,
        listing.ownerUserId,
        {
          userId: invitation.recipientUserId
        },
        invitation.blockGeneration ?? 0,
        { id: invitation.listingId, generation: invitation.listingGeneration ?? 0 },
        invitation
      )
    : null
  const occurredAt = invalidation ? invalidation.invalidatedAt : now
  await ctx.db.patch(_id, {
    ...(invalidation
      ? invitationInvalidationPatch(invitation.version, invalidation)
      : { status: 'EXPIRED' as const, expiredAt: now }),
    updatedAt: new Date(
      Math.max(Date.parse(now), Date.parse(invitation.updatedAt) + 1)
    ).toISOString(),
    version: invitation.version + 1
  })
  await cancelNotification(ctx, {
    recipientUserId: invitation.recipientUserId,
    sourcePublicId: invitation.id,
    workflowKey: 'social-invitation-received',
    occurredAt
  })
  return true
}

export async function expireDueInvitations(ctx: MutationCtx, now: string) {
  // Existing dispatcher policy expires at most ten source records per one-minute run.
  const due = await ctx.db
    .query('campaignInvites')
    .withIndex('by_status_expiresAt_id', (q) => q.eq('status', 'PENDING').lte('expiresAt', now))
    .take(10)
  for (const invitation of due) await expireInvitation(ctx, invitation, now)
}
