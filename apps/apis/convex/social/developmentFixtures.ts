import { createFunctionHandle } from 'convex/server'
import { v } from 'convex/values'
import { internalQuery, type MutationCtx, type QueryCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { resetSocialRateLimit } from '../lib/rateLimits'
import { syncAccountUsage } from '../lib/accountUsage'
import { uuidSchema } from '@artificer-toolkit/schema/api/campaignContractSchemas'
import { components, internal } from '../_generated/api'

const FIXTURE_CAMPAIGN_NAME = 'Encounter execution fixture'
const TERMINAL_APPLICATIONS = new Set(['ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED', 'BLOCKED'])
const TERMINAL_INVITATIONS = new Set(['ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED'])
const fixtureArgs = {
  ownerUserId: v.string(),
  playerUserId: v.string(),
  inviteeUserId: v.string(),
  moderatorUserId: v.string(),
  campaignId: v.string()
}

type FixtureArgs = { [K in keyof typeof fixtureArgs]: string }

async function readFixtureState(ctx: QueryCtx | MutationCtx, args: FixtureArgs) {
  const userIds = [args.ownerUserId, args.playerUserId, args.inviteeUserId, args.moderatorUserId]
  if (new Set(userIds).size !== userIds.length)
    throw new Error('Four distinct fixture accounts are required.')
  for (const userId of userIds) await requireFixtureAccount(ctx, userId)
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', args.campaignId))
    .unique()
  if (
    !campaign ||
    campaign.ownerUserId !== args.ownerUserId ||
    campaign.name !== FIXTURE_CAMPAIGN_NAME
  )
    throw new Error('Fixture Campaign ownership mismatch.')
  const profiles = await Promise.all(
    userIds.map((userId) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
    )
  )
  if (profiles.some((profile) => profile === null))
    throw new Error('Fixture Social profile is missing.')
  const socialProfiles = profiles.filter(
    (profile): profile is NonNullable<typeof profile> => profile !== null
  )
  const profileIds = new Set(socialProfiles.map((profile) => profile.id))
  const listing = await ctx.db
    .query('socialListings')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .unique()
  const [applications, invitations] = listing
    ? await Promise.all([
        ctx.db
          .query('socialApplications')
          .withIndex('by_listingId_status', (q) => q.eq('listingId', listing.id))
          .take(17),
        ctx.db
          .query('campaignInvites')
          .withIndex('by_listingId_status', (q) => q.eq('listingId', listing.id))
          .take(17)
      ])
    : [[], []]
  if (applications.length > 16 || invitations.length > 16)
    throw new Error('Fixture Social dependency bounds exceeded.')
  if (
    applications.some((application) => !profileIds.has(application.applicantProfileId)) ||
    invitations.some(
      (invitation) =>
        !userIds.includes(invitation.createdBy) || !userIds.includes(invitation.recipientUserId)
    )
  )
    throw new Error('Fixture Social dependency ownership mismatch.')
  const applicationIds = new Set(applications.map((application) => application.id))
  const listingIds = new Set(listing ? [listing.id] : [])
  // ponytail: fixture-only ceiling; add an index only if this synthetic proof needs more than 32 reports.
  const reportRows = await ctx.db.query('socialReports').take(33)
  if (reportRows.length > 32) throw new Error('Fixture Social report bounds exceeded.')
  const reports = reportRows.filter(
    (report) =>
      profileIds.has(report.reporterProfileId) ||
      (report.targetProfileId !== null && profileIds.has(report.targetProfileId)) ||
      (report.targetListingId !== null && listingIds.has(report.targetListingId)) ||
      (report.targetApplicationId !== null && applicationIds.has(report.targetApplicationId))
  )
  for (const report of reports) {
    if (
      !profileIds.has(report.reporterProfileId) ||
      (report.targetProfileId !== null && !profileIds.has(report.targetProfileId)) ||
      (report.targetListingId !== null && !listingIds.has(report.targetListingId)) ||
      (report.targetApplicationId !== null && !applicationIds.has(report.targetApplicationId))
    )
      throw new Error('Fixture Social report ownership mismatch.')
  }
  const reportIds = new Set(reports.map((report) => report.id))
  const auditPages = await Promise.all(
    userIds.map((userId) =>
      ctx.db
        .query('socialModerationActions')
        .withIndex('by_moderatorUserId', (q) => q.eq('moderatorUserId', userId))
        .take(33)
    )
  )
  if (auditPages.some((page) => page.length > 32))
    throw new Error('Fixture Social audit bounds exceeded.')
  const reportAuditPages = await Promise.all(
    reports.map((report) =>
      ctx.db
        .query('socialModerationActions')
        .withIndex('by_reportId_createdAt_id', (q) => q.eq('reportId', report.id))
        .take(17)
    )
  )
  if (reportAuditPages.some((page) => page.length > 16))
    throw new Error('Fixture Social audit bounds exceeded.')
  const audits = [
    ...new Map(
      [...auditPages.flat(), ...reportAuditPages.flat()].map((audit) => [audit._id, audit])
    ).values()
  ]
  for (const audit of audits) {
    const selectedReport = reportIds.has(audit.reportId)
    const parent = selectedReport
      ? null
      : await ctx.db
          .query('socialReports')
          .withIndex('by_publicId', (q) => q.eq('id', audit.reportId))
          .unique()
    if (
      !userIds.includes(audit.moderatorUserId) ||
      (audit.affectedProfileId !== null && !profileIds.has(audit.affectedProfileId)) ||
      (audit.affectedListingId !== null && !listingIds.has(audit.affectedListingId)) ||
      (!selectedReport &&
        (parent !== null || (audit.affectedProfileId === null && audit.affectedListingId === null)))
    )
      throw new Error('Fixture Social audit ownership mismatch.')
  }
  const memberships = await Promise.all(
    userIds.map((userId) =>
      ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', userId)
        )
        .unique()
    )
  )
  return {
    campaign,
    listing,
    profiles: socialProfiles,
    applications,
    invitations,
    reports,
    audits,
    memberships
  }
}

export const inspectFixtureState = internalQuery({
  args: fixtureArgs,
  returns: v.object({
    listing: v.union(
      v.null(),
      v.object({
        id: v.string(),
        status: v.string(),
        moderationStatus: v.string(),
        version: v.number()
      })
    ),
    profiles: v.array(
      v.object({
        userId: v.string(),
        id: v.string(),
        status: v.string(),
        contentPreference: v.string(),
        adultAttestedAt: v.union(v.null(), v.string())
      })
    ),
    applications: v.array(v.object({ id: v.string(), status: v.string(), version: v.number() })),
    invitations: v.array(v.object({ id: v.string(), status: v.string(), version: v.number() })),
    reports: v.array(
      v.object({ id: v.string(), targetKind: v.string(), status: v.string(), version: v.number() })
    ),
    auditCount: v.number()
  }),
  handler: async (ctx, args) => {
    const state = await readFixtureState(ctx, args)
    return {
      listing: state.listing
        ? {
            id: state.listing.id,
            status: state.listing.status,
            moderationStatus: state.listing.moderationStatus,
            version: state.listing.version
          }
        : null,
      profiles: state.profiles.map((profile) => ({
        userId: profile.userId,
        id: profile.id,
        status: profile.status,
        contentPreference: profile.contentPreference,
        adultAttestedAt: profile.adultAttestedAt
      })),
      applications: state.applications.map((application) => ({
        id: application.id,
        status: application.status,
        version: application.version
      })),
      invitations: state.invitations.map((invitation) => ({
        id: invitation.id,
        status: invitation.status,
        version: invitation.version
      })),
      reports: state.reports.map((report) => ({
        id: report.id,
        targetKind: report.targetKind,
        status: report.status,
        version: report.version
      })),
      auditCount: state.audits.length
    }
  }
})

export const accountCleanupComplete = internalQuery({
  args: {
    observerUserId: v.string(),
    subjects: v.array(v.object({ userId: v.string(), profileId: v.string() }))
  },
  returns: v.boolean(),
  handler: async (ctx, { observerUserId, subjects }) => {
    await requireFixtureAccount(ctx, observerUserId)
    if (
      subjects.length < 1 ||
      subjects.length > 3 ||
      subjects.some(
        ({ userId, profileId }) =>
          userId === observerUserId ||
          !uuidSchema.safeParse(userId).success ||
          !uuidSchema.safeParse(profileId).success
      ) ||
      new Set(subjects.map(({ userId }) => userId)).size !== subjects.length ||
      new Set(subjects.map(({ profileId }) => profileId)).size !== subjects.length
    )
      throw new Error('Unique fixture cleanup subjects are required.')
    for (const { userId, profileId } of subjects) {
      const [
        account,
        profileByUser,
        profileById,
        outgoing,
        incoming,
        created,
        received,
        deliveries,
        feed
      ] = await Promise.all([
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', userId))
          .unique(),
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', userId))
          .unique(),
        ctx.db
          .query('socialProfiles')
          .withIndex('by_publicId', (q) => q.eq('id', profileId))
          .unique(),
        ctx.db
          .query('socialBlocks')
          .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
            q.eq('blockerProfileId', profileId)
          )
          .first(),
        ctx.db
          .query('socialBlocks')
          .withIndex('by_blockedProfileId_blockerProfileId', (q) =>
            q.eq('blockedProfileId', profileId)
          )
          .first(),
        ctx.db
          .query('campaignInvites')
          .withIndex('by_createdBy_id', (q) => q.eq('createdBy', userId))
          .first(),
        ctx.db
          .query('campaignInvites')
          .withIndex('by_recipientUserId_status_createdAt_id', (q) =>
            q.eq('recipientUserId', userId)
          )
          .first(),
        ctx.db
          .query('notificationDeliveryIntents')
          .withIndex('by_recipientUserId', (q) => q.eq('recipientUserId', userId))
          .first(),
        ctx.db
          .query('notificationFeedItems')
          .withIndex('by_userId_occurredAt_id', (q) => q.eq('userId', userId))
          .first()
      ])
      if (
        account ||
        profileByUser ||
        profileById ||
        outgoing ||
        incoming ||
        created ||
        received ||
        deliveries ||
        feed
      )
        return false
    }
    return true
  }
})

const OWNED_CAMPAIGN_DELETION_RESTRICTION = 'Account deletion is restricted by owned Campaigns.'

function hasOwnedCampaignDeletionRestriction(error: unknown) {
  if (!(error instanceof Error)) return false
  let firstLine = error.message.replace(/\r\n/g, '\n').split('\n', 1)[0] ?? ''
  while (firstLine.startsWith('Uncaught Error: '))
    firstLine = firstLine.slice('Uncaught Error: '.length)
  return firstLine === OWNED_CAMPAIGN_DELETION_RESTRICTION
}

export const assertOwnedCampaignDeletionRestricted = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await requireFixtureAccount(ctx, userId)
    const account = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (!account) throw new Error('Fixture profile is missing.')
    try {
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'user', where: [{ field: '_id', value: account.authUserId }] },
        onDeleteHandle: await createFunctionHandle(internal.auth.onDelete)
      })
    } catch (error) {
      if (hasOwnedCampaignDeletionRestriction(error)) return null
      throw error
    }
    throw new Error('Expected owned Campaign account deletion restriction.')
  }
})

export const ageFixtureRecords = internalMutation({
  args: fixtureArgs,
  returns: v.object({
    applications: v.number(),
    invitations: v.number(),
    reports: v.number(),
    memberships: v.number()
  }),
  handler: async (ctx, args) => {
    const state = await readFixtureState(ctx, args)
    const terminalAt = new Date(Date.now() - 181 * 86_400_000).toISOString()
    const reportAt = new Date(Date.now() - 3 * 366 * 86_400_000).toISOString()
    let applications = 0
    let invitations = 0
    let reports = 0
    let memberships = 0
    for (const row of state.applications)
      if (TERMINAL_APPLICATIONS.has(row.status)) {
        const timestamp = row.respondedAt ?? row.withdrawnAt ?? row.expiredAt ?? row.blockedAt
        if (timestamp !== null) {
          await ctx.db.patch(row._id, {
            updatedAt: terminalAt,
            ...(row.status === 'ACCEPTED' || row.status === 'DECLINED'
              ? { respondedAt: terminalAt }
              : row.status === 'WITHDRAWN'
                ? { withdrawnAt: terminalAt }
                : row.status === 'EXPIRED'
                  ? { expiredAt: terminalAt }
                  : { blockedAt: terminalAt })
          })
          applications++
        }
      }
    for (const row of state.invitations)
      if (TERMINAL_INVITATIONS.has(row.status)) {
        const timestamp = row.respondedAt ?? row.revokedAt ?? row.expiredAt
        if (timestamp !== null) {
          await ctx.db.patch(row._id, {
            updatedAt: terminalAt,
            ...(row.status === 'ACCEPTED' || row.status === 'DECLINED'
              ? { respondedAt: terminalAt }
              : row.status === 'REVOKED'
                ? { revokedAt: terminalAt }
                : { expiredAt: terminalAt })
          })
          invitations++
        }
      }
    for (const row of state.reports)
      if ((row.status === 'RESOLVED' || row.status === 'DISMISSED') && row.resolvedAt !== null) {
        await ctx.db.patch(row._id, { resolvedAt: reportAt, updatedAt: reportAt })
        reports++
      }
    for (const membership of state.memberships)
      if (
        membership?.role === 'PLAYER' &&
        membership.status === 'LEFT' &&
        membership.leftAt !== null
      ) {
        await ctx.db.patch(membership._id, { leftAt: terminalAt })
        memberships++
      }
    return { applications, invitations, reports, memberships }
  }
})

export const resetBlockPair = internalMutation({
  args: { blockerUserId: v.string(), blockedUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { blockerUserId, blockedUserId }) => {
    if (blockerUserId === blockedUserId) throw new Error('Distinct fixture accounts are required.')
    await requireFixtureAccount(ctx, blockerUserId)
    await requireFixtureAccount(ctx, blockedUserId)
    const [blocker, blocked] = await Promise.all(
      [blockerUserId, blockedUserId].map((userId) =>
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', userId))
          .unique()
      )
    )
    if (!blocker || !blocked) throw new Error('Fixture Social profile is missing.')
    const block = await ctx.db
      .query('socialBlocks')
      .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
        q.eq('blockerProfileId', blocker.id).eq('blockedProfileId', blocked.id)
      )
      .unique()
    if (!block) throw new Error('Fixture Social block is missing.')
    const reverse = await ctx.db
      .query('socialBlocks')
      .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
        q.eq('blockerProfileId', blocked.id).eq('blockedProfileId', blocker.id)
      )
      .unique()
    if (reverse) throw new Error('Fixture Social block pair is ambiguous.')
    const [first, second] = [blocker, blocked].sort((left, right) =>
      left.id.localeCompare(right.id)
    )
    const invalidations = await ctx.db
      .query('socialBlockInvalidations')
      .withIndex('by_firstProfileId_secondProfileId_generation', (q) =>
        q.eq('firstProfileId', first.id).eq('secondProfileId', second.id)
      )
      .take(3)
    if (
      invalidations.length !== 1 ||
      invalidations[0]!.firstUserId !== first.userId ||
      invalidations[0]!.secondUserId !== second.userId ||
      invalidations[0]!.generation !== block.invalidationGeneration
    )
      throw new Error('Fixture Social block invalidation mismatch.')
    await ctx.db.delete(block._id)
    await ctx.db.delete(invalidations[0]!._id)
    await resetSocialRateLimit(ctx, blockerUserId, 'BLOCK')
    return null
  }
})

export const removeFixtureState = internalMutation({
  args: fixtureArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await readFixtureState(ctx, args)
    const inviteeMembership = state.memberships[2]
    if (inviteeMembership) {
      if (inviteeMembership.role !== 'PLAYER')
        throw new Error('Fixture invitee membership mismatch.')
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', state.campaign.id).eq('userId', args.inviteeUserId)
        )
        .take(1)
      if (assignment.length) throw new Error('Fixture invitee assignment mismatch.')
    }
    for (const audit of state.audits) await ctx.db.delete(audit._id)
    for (const report of state.reports) await ctx.db.delete(report._id)
    for (const application of state.applications) await ctx.db.delete(application._id)
    if (state.listing) {
      await ctx.db.delete(state.listing._id)
      await syncAccountUsage(ctx, 'publicListings', state.listing.id)
    }
    if (inviteeMembership) await ctx.db.delete(inviteeMembership._id)
    return null
  }
})
