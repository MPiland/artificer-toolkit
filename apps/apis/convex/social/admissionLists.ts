import { mergedStream, stream } from 'convex-helpers/server/stream'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialAdmissionListInputSchema,
  socialListingAdmissionListInputSchema,
  socialInvitationListInputSchema,
  socialListingInvitationListInputSchema,
  socialApplicationPageSchema,
  socialInvitationPageSchema,
  type SocialAdmissionListInput,
  type SocialListingAdmissionListInput,
  type SocialInvitationListInput,
  type SocialListingInvitationListInput,
  type SocialApplicationPage,
  type SocialInvitationPage
} from '@artificer-toolkit/schema/api/socialAdmissionLists'
import { socialApplicationStatusDtoSchema } from '@artificer-toolkit/schema/api/socialHub'
import { campaignInviteStatusDtoSchema } from '@artificer-toolkit/schema/api/campaignCore'
import { query, type QueryCtx } from '../_generated/server'
import schema from '../schema'
import {
  findApplication,
  findInvitation,
  presentApplication,
  presentInvitation
} from './admissionDocuments'
import { requireOwnedListing } from './listingDocuments'
import { requireSocialViewer, hasSocialBlock } from './visibility'

async function applicationPage(
  ctx: QueryCtx,
  input: SocialAdmissionListInput | SocialListingAdmissionListInput
): Promise<SocialApplicationPage> {
  const actor = await requireSocialViewer(ctx)
  const owned =
    'listingPublicId' in input
      ? await requireOwnedListing(ctx, input.listingPublicId, actor.userId)
      : null
  const applications = stream(ctx.db, schema).query('socialApplications')
  const byStatus = (status: (typeof socialApplicationStatusDtoSchema.options)[number]) =>
    (owned
      ? applications.withIndex('by_listingId_status_submittedAt_id', (q) =>
          q.eq('listingId', owned.listing.id).eq('status', status)
        )
      : applications.withIndex('by_applicantProfileId_status_submittedAt_id', (q) =>
          q.eq('applicantProfileId', actor.id).eq('status', status)
        )
    ).order('desc')
  const result = await mergedStream(
    socialApplicationStatusDtoSchema.options
      .filter((status) => input.group === 'HISTORY' || status === 'SUBMITTED')
      .map(byStatus),
    ['submittedAt', 'id']
  )
    .map(async (row) => {
      const value = await findApplication(ctx, row.id)
      if (
        !value ||
        value.host.status !== 'ACTIVE' ||
        (!value.applicant && input.group === 'PENDING') ||
        (value.applicant &&
          (value.applicant.status !== 'ACTIVE' ||
            (await hasSocialBlock(ctx, value.host.id, value.applicant.id))))
      )
        return null
      const presented = await presentApplication(
        ctx,
        value,
        owned === null,
        owned !== null || actor.contentPreference === 'MATURE'
      )
      return (presented.status === 'SUBMITTED') === (input.group === 'PENDING') ? presented : null
    })
    .paginate({ ...input.paginationOpts, maximumRowsRead: 8, maximumBytesRead: 1024 * 1024 })
  return socialApplicationPageSchema.parse(result)
}

async function invitationPage(
  ctx: QueryCtx,
  input: SocialInvitationListInput | SocialListingInvitationListInput
): Promise<SocialInvitationPage> {
  const actor = await requireSocialViewer(ctx)
  const owned =
    'listingPublicId' in input
      ? await requireOwnedListing(ctx, input.listingPublicId, actor.userId)
      : null
  const invitations = stream(ctx.db, schema).query('campaignInvites')
  const byStatus = (status: (typeof campaignInviteStatusDtoSchema.options)[number]) =>
    (owned
      ? invitations.withIndex('by_listingId_status_createdAt_id', (q) =>
          q.eq('listingId', owned.listing.id).eq('status', status)
        )
      : invitations.withIndex('by_recipientUserId_status_createdAt_id', (q) =>
          q.eq('recipientUserId', actor.userId).eq('status', status)
        )
    ).order('desc')
  const asOf = Date.parse(input.asOf)
  const result = await mergedStream(
    campaignInviteStatusDtoSchema.options
      .filter((status) => input.group === 'HISTORY' || status === 'PENDING')
      .map((status) =>
        status === 'PENDING'
          ? byStatus(status).filterWith(
              async (row) => Date.parse(row.expiresAt) > asOf || input.group === 'HISTORY'
            )
          : byStatus(status)
      ),
    ['createdAt', 'id']
  )
    .map(async (row) => {
      const value = await findInvitation(ctx, row.id)
      if (
        !value ||
        value.host.status !== 'ACTIVE' ||
        value.recipient.status !== 'ACTIVE' ||
        (await hasSocialBlock(ctx, value.host.id, value.recipient.id))
      )
        return null
      const presented = await presentInvitation(
        ctx,
        value,
        owned !== null || actor.contentPreference === 'MATURE',
        asOf
      )
      return (presented.status === 'PENDING') === (input.group === 'PENDING') ? presented : null
    })
    .paginate({ ...input.paginationOpts, maximumRowsRead: 8, maximumBytesRead: 1024 * 1024 })
  return socialInvitationPageSchema.parse(result)
}

export const listOwnApplications = query({
  args: zodToConvexFields(socialAdmissionListInputSchema.shape),
  returns: zodToConvex(socialApplicationPageSchema),
  handler: (ctx, args) => applicationPage(ctx, socialAdmissionListInputSchema.parse(args))
})

export const listListingApplications = query({
  args: zodToConvexFields(socialListingAdmissionListInputSchema.shape),
  returns: zodToConvex(socialApplicationPageSchema),
  handler: (ctx, args) => applicationPage(ctx, socialListingAdmissionListInputSchema.parse(args))
})

export const listReceivedInvitations = query({
  args: zodToConvexFields(socialInvitationListInputSchema.shape),
  returns: zodToConvex(socialInvitationPageSchema),
  handler: (ctx, args) => invitationPage(ctx, socialInvitationListInputSchema.parse(args))
})

export const listListingInvitations = query({
  args: zodToConvexFields(socialListingInvitationListInputSchema.shape),
  returns: zodToConvex(socialInvitationPageSchema),
  handler: (ctx, args) => invitationPage(ctx, socialListingInvitationListInputSchema.parse(args))
})
