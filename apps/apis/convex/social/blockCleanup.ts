import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import {
  socialStoredApplicationSchema,
  socialStoredListingSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { type MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { cancelNotification } from '../notifications/intents'
import {
  readAdmissionInvalidation,
  applicationInvalidationPatch,
  invitationInvalidationPatch
} from './admissionInvalidation'

const PAGE_SIZE = 20
const phases = [
  'APPLICATION_FIRST',
  'APPLICATION_SECOND',
  'INVITATION_FIRST',
  'INVITATION_SECOND'
] as const
type CleanupPhase = (typeof phases)[number]
type CleanupArgs = {
  firstProfileId: string
  secondProfileId: string
  firstUserId: string
  secondUserId: string
  generation: number
  invalidatedAt: string
  phase: CleanupPhase
  cursor: string | null
}
const nextPage = makeFunctionReference<'mutation', CleanupArgs, null>('social/blockCleanup:run')

async function currentListingOwner(ctx: MutationCtx, listingId: string) {
  const row = await ctx.db
    .query('socialListings')
    .withIndex('by_publicId', (q) => q.eq('id', listingId))
    .unique()
  if (!row) return null
  const { _id, _creationTime, ...stored } = row
  return socialStoredListingSchema.parse(stored).ownerUserId
}

function isSnapshotPair(
  hostUserId: string,
  participantProfileId: string,
  participantUserId: string,
  args: CleanupArgs
) {
  return (
    (participantProfileId === args.firstProfileId &&
      participantUserId === args.firstUserId &&
      hostUserId === args.secondUserId) ||
    (participantProfileId === args.secondProfileId &&
      participantUserId === args.secondUserId &&
      hostUserId === args.firstUserId)
  )
}

export const run = internalMutation({
  args: {
    firstProfileId: v.string(),
    secondProfileId: v.string(),
    firstUserId: v.string(),
    secondUserId: v.string(),
    generation: v.number(),
    invalidatedAt: v.string(),
    phase: v.union(...phases.map((phase) => v.literal(phase))),
    cursor: v.union(v.null(), v.string())
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const application = args.phase.startsWith('APPLICATION')
    const first = args.phase.endsWith('FIRST')
    const profileId = first ? args.firstProfileId : args.secondProfileId
    const userId = first ? args.firstUserId : args.secondUserId
    const page = application
      ? await ctx.db
          .query('socialApplications')
          .withIndex('by_applicantProfileId_status_submittedAt_id', (q) =>
            q.eq('applicantProfileId', profileId).eq('status', 'SUBMITTED')
          )
          .paginate({ cursor: args.cursor, numItems: PAGE_SIZE })
      : await ctx.db
          .query('campaignInvites')
          .withIndex('by_recipientUserId_status_createdAt_id', (q) =>
            q.eq('recipientUserId', userId).eq('status', 'PENDING')
          )
          .paginate({ cursor: args.cursor, numItems: PAGE_SIZE })
    for (const row of page.page) {
      const { _id, _creationTime, ...stored } = row
      if (application) {
        const record = socialStoredApplicationSchema.parse(stored)
        const ownerUserId = await currentListingOwner(ctx, record.listingId)
        if (
          !ownerUserId ||
          !isSnapshotPair(ownerUserId, record.applicantProfileId, userId, args) ||
          (record.blockGeneration ?? 0) >= args.generation
        )
          continue
        const event = await readAdmissionInvalidation(
          ctx,
          ownerUserId,
          { profileId: record.applicantProfileId },
          record.blockGeneration ?? 0,
          { id: record.listingId, generation: record.listingGeneration ?? 0 },
          record
        )
        if (!event || (event.kind === 'BLOCK' && event.generation > args.generation))
          throw new Error('Social block invalidation is unavailable.')
        await ctx.db.patch(_id, applicationInvalidationPatch(record.version, event))
        await cancelNotification(ctx, {
          recipientUserId: ownerUserId,
          sourcePublicId: record.id,
          workflowKey: 'social-application-submitted',
          occurredAt: event.invalidatedAt
        })
      } else {
        const record = campaignStoredInviteSchema.parse(stored)
        const ownerUserId = await currentListingOwner(ctx, record.listingId)
        if (
          !ownerUserId ||
          record.createdBy !== ownerUserId ||
          !isSnapshotPair(ownerUserId, profileId, record.recipientUserId, args) ||
          (record.blockGeneration ?? 0) >= args.generation
        )
          continue
        const event = await readAdmissionInvalidation(
          ctx,
          ownerUserId,
          { userId: record.recipientUserId },
          record.blockGeneration ?? 0,
          { id: record.listingId, generation: record.listingGeneration ?? 0 },
          record
        )
        if (!event || (event.kind === 'BLOCK' && event.generation > args.generation))
          throw new Error('Social block invalidation is unavailable.')
        await ctx.db.patch(_id, invitationInvalidationPatch(record.version, event))
        await cancelNotification(ctx, {
          recipientUserId: record.recipientUserId,
          sourcePublicId: record.id,
          workflowKey: 'social-invitation-received',
          occurredAt: event.invalidatedAt
        })
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, nextPage, { ...args, cursor: page.continueCursor })
      return null
    }
    const index = phases.indexOf(args.phase)
    if (index < phases.length - 1)
      await ctx.scheduler.runAfter(0, nextPage, { ...args, phase: phases[index + 1], cursor: null })
    return null
  }
})
