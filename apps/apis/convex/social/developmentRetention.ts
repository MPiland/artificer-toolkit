import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { internalMutation } from '../lib/mutations'
import {
  socialRetentionApplyInputSchema,
  socialRetentionApplyResultSchema,
  socialRetentionPreviewInputSchema,
  socialRetentionPreviewResultSchema
} from '@artificer-toolkit/schema/api/socialRetention'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { deleteRetentionMatches, selectRetentionPage } from './retention'

const fixtureCampaignName = 'Encounter execution fixture'

const fixtureRetentionArgs = {
  userIds: v.array(v.string()),
  campaignId: v.string(),
  input: zodToConvex(socialRetentionPreviewInputSchema)
}

const fixtureRetentionApplyArgs = {
  userIds: v.array(v.string()),
  campaignId: v.string(),
  input: zodToConvex(socialRetentionApplyInputSchema)
}

type FixtureScope = {
  userIds: Set<string>
  profileIds: Set<string>
  listingId: string | null
}

function requireFixtureCohort(userIds: string[]) {
  if (userIds.length < 1 || userIds.length > 4 || new Set(userIds).size !== userIds.length)
    throw new Error('One to four unique fixture account IDs are required.')
}

async function fixtureScope(
  ctx: QueryCtx | MutationCtx,
  userIds: string[],
  campaignId: string
): Promise<FixtureScope> {
  requireFixtureCohort(userIds)
  for (const userId of userIds) await requireFixtureAccount(ctx, userId)
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaignId))
    .unique()
  if (!campaign || campaign.name !== fixtureCampaignName || !userIds.includes(campaign.ownerUserId))
    throw new Error('Fixture Campaign ownership or identity mismatch.')
  const profiles = await Promise.all(
    userIds.map((userId) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
    )
  )
  const listings = await ctx.db
    .query('socialListings')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .take(2)
  return {
    userIds: new Set(userIds),
    profileIds: new Set(profiles.flatMap((profile) => (profile ? [profile.id] : []))),
    listingId: listings.length === 1 ? listings[0]!.id : null
  }
}

async function isFixturePage(
  ctx: QueryCtx | MutationCtx,
  page: Awaited<ReturnType<typeof selectRetentionPage>>['page'],
  scope: FixtureScope
) {
  if (page.phase === 'INVITATIONS')
    return page.rows.every(
      (row) =>
        scope.listingId !== null &&
        row.listingId === scope.listingId &&
        scope.userIds.has(row.createdBy) &&
        scope.userIds.has(row.recipientUserId)
    )
  if (page.phase === 'APPLICATIONS')
    return page.rows.every(
      (row) =>
        scope.listingId !== null &&
        row.listingId === scope.listingId &&
        scope.profileIds.has(row.applicantProfileId)
    )
  for (const row of page.rows) {
    if (!scope.profileIds.has(row.reporterProfileId)) return false
    if (row.targetProfileId !== null && !scope.profileIds.has(row.targetProfileId)) return false
    if (row.targetListingId !== null && row.targetListingId !== scope.listingId) return false
    if (row.targetApplicationId !== null) {
      const application = await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', row.targetApplicationId!))
        .unique()
      if (
        !application ||
        application.listingId !== scope.listingId ||
        !scope.profileIds.has(application.applicantProfileId)
      )
        return false
    }
    const actualTarget =
      row.targetKind === 'PROFILE'
        ? row.targetProfileId !== null && scope.profileIds.has(row.targetProfileId)
        : row.targetKind === 'LISTING'
          ? row.targetListingId !== null && row.targetListingId === scope.listingId
          : row.targetApplicationId !== null
    if (!actualTarget) return false
    const audits = await ctx.db
      .query('socialModerationActions')
      .withIndex('by_reportId_createdAt_id', (q) => q.eq('reportId', row.id))
      .take(17)
    if (
      audits.length > 16 ||
      audits.some(
        (audit) =>
          !scope.userIds.has(audit.moderatorUserId) ||
          (audit.affectedProfileId !== null && !scope.profileIds.has(audit.affectedProfileId)) ||
          (audit.affectedListingId !== null && audit.affectedListingId !== scope.listingId)
      )
    )
      return false
  }
  return true
}

export const previewFixturePage = internalQuery({
  args: fixtureRetentionArgs,
  returns: v.object({
    ...zodToConvexFields(socialRetentionPreviewResultSchema.shape),
    fixtureOnly: v.boolean()
  }),
  handler: async (ctx, { userIds, campaignId, input }) => {
    const parsed = socialRetentionPreviewInputSchema.parse(input)
    const scope = await fixtureScope(ctx, userIds, campaignId)
    const { page, matches, summary } = await selectRetentionPage(ctx, parsed)
    return {
      ...summary,
      eligible: matches.length,
      fixtureOnly: await isFixturePage(ctx, page, scope)
    }
  }
})

export const applyFixturePage = internalMutation({
  args: fixtureRetentionApplyArgs,
  returns: zodToConvex(socialRetentionApplyResultSchema),
  handler: async (ctx, { userIds, campaignId, input }) => {
    const parsed = socialRetentionApplyInputSchema.parse(input)
    const scope = await fixtureScope(ctx, userIds, campaignId)
    const selection = await selectRetentionPage(ctx, parsed, true)
    if (!(await isFixturePage(ctx, selection.page, scope)))
      throw new Error('Fixture retention page contains foreign records.')
    return deleteRetentionMatches(ctx, selection)
  }
})
