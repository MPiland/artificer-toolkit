import type { Doc, Id, TableNames } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { removeCampaignEncounterRuns } from '../encounters/campaignDeletion'
import { removeCampaignScenes } from '../scenes/campaignDeletion'
import { removeCampaignAttachment } from './attachmentDocuments'
import { cancelNotification } from '../notifications/intents'

const PAGE_SIZE = 8
const MAX_RECIPIENTS =
  1 + Math.max(...Object.values(ENTITLEMENT_LIMITS).map((tier) => tier.playerSeatsPerCampaign))

async function deletePage(ctx: MutationCtx, rows: ReadonlyArray<{ _id: Id<TableNames> }>) {
  for (const row of rows) await ctx.db.delete(row._id)
  return rows.length === 0
}

/** Each phase deletes at most a bounded page and retains its parent until every child is gone. */
export async function removeCampaignState(ctx: MutationCtx, job: Doc<'campaignDeletionJobs'>) {
  const campaignId = job.campaignId
  const phases = [
    async () => removeCampaignEncounterRuns(ctx, campaignId),
    async () => removeCampaignScenes(ctx, campaignId),
    async () => {
      const rows = await ctx.db
        .query('campaignAttachments')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
        .take(PAGE_SIZE)
      for (const row of rows) await removeCampaignAttachment(ctx, row)
      return rows.length === 0
    },
    async () => {
      const row = await ctx.db
        .query('campaignAnnouncements')
        .withIndex('by_campaignId_publicId', (q) => q.eq('campaignId', campaignId))
        .first()
      if (!row) return true
      const intents = await ctx.db
        .query('notificationDeliveryIntents')
        .withIndex('by_sourcePublicId_workflowKey', (q) =>
          q
            .eq('sourcePublicId', row.announcementPublicId)
            .eq('workflowKey', 'campaign-announcement')
        )
        .take(MAX_RECIPIENTS + 1)
      if (intents.length > MAX_RECIPIENTS)
        throw new Error('Campaign announcement recipient capacity exceeded.')
      for (const intent of intents) {
        await cancelNotification(ctx, {
          recipientUserId: intent.recipientUserId,
          sourcePublicId: row.announcementPublicId,
          workflowKey: 'campaign-announcement',
          occurredAt: job.createdAt
        })
      }
      await ctx.db.delete(row._id)
      return false
    },
    async () => {
      const entry = await ctx.db
        .query('campaignConversationEntries')
        .withIndex('by_campaignId_authorUserId_createdAt', (q) => q.eq('campaignId', campaignId))
        .first()
      if (!entry) return true
      const payloads = await ctx.db
        .query('campaignConversationEntryPayloads')
        .withIndex('by_entryId', (q) => q.eq('entryId', entry.id))
        .take(PAGE_SIZE)
      if (await deletePage(ctx, payloads)) await ctx.db.delete(entry._id)
      return false
    },
    async () => {
      const conversation = await ctx.db
        .query('campaignConversations')
        .withIndex('by_campaignId_kind', (q) => q.eq('campaignId', campaignId))
        .first()
      if (!conversation) return true
      const members = await ctx.db
        .query('campaignConversationMembers')
        .withIndex('by_conversationId_userId', (q) => q.eq('conversationId', conversation.id))
        .take(PAGE_SIZE)
      if (await deletePage(ctx, members)) await ctx.db.delete(conversation._id)
      return false
    },
    async () => {
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
        .unique()
      if (!listing) return true
      const applications = await ctx.db
        .query('socialApplications')
        .withIndex('by_listingId_status', (q) => q.eq('listingId', listing.id))
        .take(PAGE_SIZE)
      if (!(await deletePage(ctx, applications))) return false
      const invites = await ctx.db
        .query('campaignInvites')
        .withIndex('by_listingId_status', (q) => q.eq('listingId', listing.id))
        .take(PAGE_SIZE)
      if (!(await deletePage(ctx, invites))) return false
      await ctx.db.delete(listing._id)
      return false
    },
    async () => {
      const cleanup = await ctx.db
        .query('campaignVehicleCleanupJobs')
        .withIndex('by_campaignId_status_id', (q) => q.eq('grant.campaignId', campaignId))
        .first()
      if (!cleanup) return true
      if (
        cleanup.grant.campaignId !== campaignId ||
        cleanup.grantChecksum !==
          checksumCanonicalJson({ operation: 'VEHICLE_CLEANUP_GRANT', grant: cleanup.grant })
      )
        throw new Error('Campaign deletion Vehicle cleanup scope mismatch.')
      const totals = await ctx.db
        .query('campaignVehicleCleanupTotals')
        .withIndex('by_jobId_slot', (q) => q.eq('jobId', cleanup.id))
        .take(PAGE_SIZE)
      if (!(await deletePage(ctx, totals))) return false
      const segments = await ctx.db
        .query('campaignVehicleCleanupSegments')
        .withIndex('by_jobId_sequence', (q) => q.eq('jobId', cleanup.id))
        .take(PAGE_SIZE)
      if (await deletePage(ctx, segments)) await ctx.db.delete(cleanup._id)
      return false
    },
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignSessionReferences')
          .withIndex('by_campaignId_sessionId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignSessionAttendance')
          .withIndex('by_campaignId_sessionId_characterId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignSessionRsvps')
          .withIndex('by_campaignId_sessionId_userId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignSessionNotes')
          .withIndex('by_campaignId_sessionId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignCommands')
          .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignClocks')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignClockSegments')
          .withIndex('by_campaignId_startedAt_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignClockRecoveries')
          .withIndex('by_campaignId_boundary', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignNotebookSections')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignCharacterStates')
          .withIndex('by_campaignId_characterId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignContentShares')
          .withIndex('by_campaignId_subjectKind_subjectId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignEvents')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignOwnershipTransfers')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignPlaySettings')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignPartyItems')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignPartyCurrencyGroups')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignPartyCurrencies')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignPartyInventories')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignCurrencyDenominations')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignCurrencySystems')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignVehicles')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignLiveAuthorities')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () =>
      deletePage(
        ctx,
        await ctx.db
          .query('campaignSessions')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
          .take(PAGE_SIZE)
      ),
    async () => {
      for (const scope of ['CAMPAIGN', 'PLAY'] as const) {
        const marker = await ctx.db
          .query('sceneVisionRevisions')
          .withIndex('by_scope_id', (q) => q.eq('scope', scope).eq('id', campaignId))
          .unique()
        if (marker) await ctx.db.delete(marker._id)
      }
      return true
    }
  ]
  const phase = phases[job.phase]
  if (!phase) throw new Error('Campaign deletion phase is invalid.')
  const next = job.phase + ((await phase()) ? 1 : 0)
  return { phase: next, done: next === phases.length }
}
