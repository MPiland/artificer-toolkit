import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  beginCampaignCopyInputSchema,
  campaignCopyListInputSchema,
  campaignCopyListPageSchema,
  campaignCopyLookupSchema,
  campaignCopyProgressSchema,
  type CampaignCopyListPage,
  type CampaignCopyProgress
} from '@artificer-toolkit/schema/api/campaignCopy'
import { createCampaignInputSchema } from '@artificer-toolkit/schema/api/campaignCore'
import { campaignStoredCopySchema } from '@artificer-toolkit/schema/projections/campaignCopyPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { campaignStoredNotebookSectionSchema } from '@artificer-toolkit/schema/projections/campaignNotebookPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalMutation, mutation } from '../lib/mutations'
import { query } from '../lib/queries'
import type { Doc } from '../_generated/dataModel'
import { requireIdentity } from '../lib/identity'
import { readAuthUser } from '../lib/authUserReads'
import { createCampaignForOwner } from './create'
import { assertCampaignContentAllowed } from './contentUsage'
import { readCampaignDetail, requireCampaignAuthority } from './documents'

const PAGE_SIZE = 8
const MAX_BYTES = 1024 * 1024
const EXPIRY_MS = 24 * 60 * 60 * 1000
const runCopy = makeFunctionReference<'mutation', { copyId: string }, null>(
  'campaigns/copyJobs:run'
)
const stepCopy = makeFunctionReference<'mutation', { copyId: string }, null>(
  'campaigns/copyJobs:step'
)
const cleanupJob = makeFunctionReference<'mutation', { copyId: string }, null>(
  'campaigns/copyJobCleanup:cleanup'
)

type StoredJob = ReturnType<typeof campaignStoredCopySchema.parse>

export function parseCopyJob(row: Doc<'campaignCopyJobs'>): StoredJob {
  const { _id, _creationTime, ...value } = row
  const job = campaignStoredCopySchema.parse(value)
  if (
    job.inputFingerprint !== fingerprint(job.ownerUserId, job.command) ||
    job.snapshotChecksum !== snapshotChecksum(job)
  )
    throw new Error('Stored Campaign copy snapshot is invalid.')
  return job
}

function fingerprint(userId: string, command: StoredJob['command']) {
  return checksumCanonicalJson({
    operation: 'CAMPAIGN_SELECTED_COPY',
    actorUserId: userId,
    command
  })
}

function snapshotChecksum(
  job: Pick<
    StoredJob,
    | 'ownerUserId'
    | 'command'
    | 'settings'
    | 'attunementSlotOverride'
    | 'sourceNotebookRevision'
    | 'destinationCampaignId'
  >
) {
  return checksumCanonicalJson({
    operation: 'CAMPAIGN_SELECTED_COPY_SNAPSHOT',
    ownerUserId: job.ownerUserId,
    command: job.command,
    settings: job.settings,
    attunementSlotOverride: job.attunementSlotOverride,
    sourceNotebookRevision: job.sourceNotebookRevision,
    destinationCampaignId: job.destinationCampaignId
  })
}

function presentProgress(
  job: StoredJob,
  destination: CampaignCopyProgress['destination']
): CampaignCopyProgress {
  return campaignCopyProgressSchema.parse({
    copyId: job.id,
    sourceCampaignId: job.command.campaignId,
    sourceName: job.settings.name,
    status: job.status,
    notebookCategories: job.command.notebookCategories,
    copiedSections: job.copiedSections,
    failureReason: job.failureReason,
    destination,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  })
}

async function findJob(ctx: Parameters<typeof requireIdentity>[0], copyId: string) {
  const row = await ctx.db
    .query('campaignCopyJobs')
    .withIndex('by_publicId', (q) => q.eq('id', copyId))
    .unique()
  if (!row) throw new Error('Campaign copy not found.')
  const job = parseCopyJob(row)

  return { row, job }
}

async function assertWorkerOwner(ctx: Parameters<typeof requireIdentity>[0], job: StoredJob) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', job.ownerUserId))
    .unique()
  if (!profile) throw new Error('Copy owner account is unavailable.')
  const user = await readAuthUser(ctx, profile.authUserId)
  if (!user || (user.banned && (!user.banExpires || user.banExpires >= Date.now())))
    throw new Error('Copy owner account is unavailable.')
  const authority = await requireCampaignAuthority(ctx, job.command.campaignId, job.ownerUserId)
  if (authority.membership.role !== 'OWNER' || authority.campaign.ownerUserId !== job.ownerUserId)
    throw new Error('Only the Campaign owner can copy a Campaign.')
  if (
    authority.campaign.version !== job.command.expectedVersion ||
    (authority.campaign.notebookRevision ?? null) !== job.sourceNotebookRevision
  )
    throw new Error('Campaign changed before this copy completed.')
  return authority.campaign
}

export const begin = mutation({
  args: zodToConvexFields(beginCampaignCopyInputSchema.shape),
  returns: zodToConvex(campaignCopyProgressSchema),
  handler: async (ctx, args): Promise<CampaignCopyProgress> => {
    const input = beginCampaignCopyInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const command = {
      ...input,
      campaignId: input.campaignId.toLowerCase(),
      commandId: input.commandId.toLowerCase(),
      notebookCategories: [...input.notebookCategories].sort()
    }
    const ownerCollision = await ctx.db
      .query('campaignCopyJobs')
      .withIndex('by_ownerUserId_commandId', (q) =>
        q.eq('ownerUserId', userId).eq('command.commandId', command.commandId)
      )
      .unique()
    const sourceCollision = await ctx.db
      .query('campaignCopyJobs')
      .withIndex('by_sourceCampaignId_commandId', (q) =>
        q.eq('command.campaignId', command.campaignId).eq('command.commandId', command.commandId)
      )
      .unique()
    for (const collision of [ownerCollision, sourceCollision]) {
      if (!collision) continue
      const existing = parseCopyJob(collision)
      if (
        existing.ownerUserId !== userId ||
        existing.inputFingerprint !== fingerprint(userId, command)
      )
        throw new Error('This command ID was already used with different input.')
      const destination =
        existing.status === 'COMPLETED'
          ? await readCampaignDetail(
              ctx,
              await requireCampaignAuthority(ctx, existing.destinationCampaignId, userId)
            )
          : null
      return presentProgress(existing, destination)
    }
    const priorEvent = await ctx.db
      .query('campaignEvents')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', command.campaignId).eq('commandId', command.commandId)
      )
      .unique()
    if (priorEvent) throw new Error('This command ID was already used with different input.')
    const sourceAuthority = await requireCampaignAuthority(ctx, command.campaignId, userId)
    if (
      sourceAuthority.membership.role !== 'OWNER' ||
      sourceAuthority.campaign.ownerUserId !== userId
    )
      throw new Error('Only the Campaign owner can copy a Campaign.')
    if (sourceAuthority.campaign.version !== command.expectedVersion)
      throw new Error('Campaign changed before this action completed.')
    const source = sourceAuthority.campaign
    const settings = createCampaignInputSchema.parse({
      name: source.name,
      description: source.description,
      format: source.format,
      toneTags: source.toneTags,
      toneDetails: source.toneDetails,
      contentMaturity: source.contentMaturity,
      gameSystemId: source.gameSystemId,
      primaryRulesCatalogueId: source.primaryRulesCatalogueId,
      additionalRulesCatalogueIds: source.additionalRulesCatalogueIds
    })
    const now = new Date().toISOString()
    const immutable = {
      ownerUserId: userId,
      command,
      destinationCampaignId: crypto.randomUUID(),
      settings,
      attunementSlotOverride: source.attunementSlotOverride,
      sourceNotebookRevision: source.notebookRevision ?? null
    }
    const valid = campaignStoredCopySchema.parse({
      id: crypto.randomUUID(),
      ...immutable,
      inputFingerprint: fingerprint(userId, command),
      snapshotChecksum: snapshotChecksum(immutable),
      status: 'RUNNING',
      terminalStatus: null,
      categoryIndex: 0,
      cursor: null,
      copiedSections: 0,
      failureReason: null,
      expiresAt: Date.now() + EXPIRY_MS,
      createdAt: now,
      updatedAt: now
    })
    await ctx.db.insert('campaignCopyJobs', valid)
    await ctx.scheduler.runAt(valid.expiresAt, cleanupJob, { copyId: valid.id })
    if (!valid.command.notebookCategories.length) {
      await ctx.runMutation(stepCopy, { copyId: valid.id })
      const completed = await findJob(ctx, valid.id)
      return presentProgress(
        completed.job,
        await readCampaignDetail(
          ctx,
          await requireCampaignAuthority(ctx, valid.destinationCampaignId, userId)
        )
      )
    }
    await ctx.scheduler.runAfter(0, runCopy, { copyId: valid.id })
    return presentProgress(valid, null)
  }
})

export const run = internalMutation({
  args: { copyId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(stepCopy, args)
    } catch {
      const row = await ctx.db
        .query('campaignCopyJobs')
        .withIndex('by_publicId', (q) => q.eq('id', args.copyId))
        .unique()
      if (!row) return null
      const found = await findJob(ctx, args.copyId)
      if (found.job.status !== 'RUNNING') return null
      await ctx.db.patch(found.row._id, {
        status: 'CLEANING',
        terminalStatus: 'FAILED',
        failureReason: 'Copy could not be completed.',
        updatedAt: new Date().toISOString()
      })
      await ctx.scheduler.runAfter(0, cleanupJob, args)
    }
    return null
  }
})

export const step = internalMutation({
  args: { copyId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('campaignCopyJobs')
      .withIndex('by_publicId', (q) => q.eq('id', args.copyId))
      .unique()
    if (!existing) return null
    const found = await findJob(ctx, args.copyId)
    const job = found.job
    if (job.status !== 'RUNNING') return null
    if (Date.now() >= job.expiresAt) throw new Error('Campaign copy expired.')
    const source = await assertWorkerOwner(ctx, job)
    const category = job.command.notebookCategories[job.categoryIndex]
    if (!category) {
      const priorEvent = await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', source.id).eq('commandId', job.command.commandId)
        )
        .unique()
      if (priorEvent) throw new Error('This command ID was already used with different input.')
      const destination = await createCampaignForOwner(
        ctx,
        job.ownerUserId,
        job.settings,
        job.attunementSlotOverride,
        job.destinationCampaignId
      )
      await ctx.db.insert(
        'campaignEvents',
        campaignStoredEventSchema.parse({
          id: crypto.randomUUID(),
          campaignId: source.id,
          actorUserId: job.ownerUserId,
          type: 'CAMPAIGN_COPIED',
          visibility: 'OWNER',
          subjectCharacterId: null,
          payloadJson: JSON.stringify({
            copiedCampaignId: destination.id,
            expectedVersion: job.command.expectedVersion
          }),
          visibleInHistory: false,
          commandId: job.command.commandId,
          inputFingerprint: job.inputFingerprint,
          createdAt: new Date().toISOString()
        })
      )
      await ctx.db.patch(found.row._id, {
        status: 'COMPLETED',
        updatedAt: new Date().toISOString()
      })
      return null
    }
    const page = await ctx.db
      .query('campaignNotebookSections')
      .withIndex('by_campaignId_category_id', (q) =>
        q.eq('campaignId', source.id).eq('category', category)
      )
      .paginate({
        cursor: job.cursor,
        numItems: PAGE_SIZE,
        maximumRowsRead: PAGE_SIZE,
        maximumBytesRead: MAX_BYTES
      })
    await assertCampaignContentAllowed(
      ctx.db,
      { id: job.destinationCampaignId, ownerUserId: job.ownerUserId },
      'campaignEntriesPerCampaign',
      page.page.length
    )
    const now = new Date().toISOString()
    for (const row of page.page) {
      const { _id, _creationTime, ...stored } = row
      const section = campaignStoredNotebookSectionSchema.parse(stored)
      await ctx.db.insert(
        'campaignNotebookSections',
        campaignStoredNotebookSectionSchema.parse({
          ...section,
          id: crypto.randomUUID(),
          campaignId: job.destinationCampaignId,
          version: 0,
          createdBy: job.ownerUserId,
          updatedBy: job.ownerUserId,
          createdAt: now,
          updatedAt: now
        })
      )
    }
    const nextCategory = page.isDone ? job.categoryIndex + 1 : job.categoryIndex
    await ctx.db.patch(found.row._id, {
      categoryIndex: nextCategory,
      cursor: page.isDone ? null : page.continueCursor,
      copiedSections: job.copiedSections + page.page.length,
      updatedAt: now
    })
    await ctx.scheduler.runAfter(0, runCopy, { copyId: job.id })
    return null
  }
})

export const progress = query({
  args: zodToConvexFields(campaignCopyLookupSchema.shape),
  returns: zodToConvex(campaignCopyProgressSchema),
  handler: async (ctx, args): Promise<CampaignCopyProgress> => {
    const input = campaignCopyLookupSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const { job } = await findJob(ctx, input.copyId)
    if (job.ownerUserId !== userId) throw new Error('Campaign copy not found.')
    const destination =
      job.status === 'COMPLETED'
        ? await readCampaignDetail(
            ctx,
            await requireCampaignAuthority(ctx, job.destinationCampaignId, userId)
          )
        : null
    return presentProgress(job, destination)
  }
})

export const cancel = mutation({
  args: zodToConvexFields(campaignCopyLookupSchema.shape),
  returns: zodToConvex(campaignCopyProgressSchema),
  handler: async (ctx, args): Promise<CampaignCopyProgress> => {
    const input = campaignCopyLookupSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const found = await findJob(ctx, input.copyId)
    if (found.job.ownerUserId !== userId) throw new Error('Campaign copy not found.')
    if (found.job.status === 'COMPLETED')
      throw new Error('Completed Campaign copies cannot be cancelled.')
    if (found.job.status !== 'RUNNING') return presentProgress(found.job, null)
    const cancelled: StoredJob = {
      ...found.job,
      status: 'CLEANING',
      terminalStatus: 'CANCELLED',
      failureReason: null,
      updatedAt: new Date().toISOString()
    }
    await ctx.db.patch(found.row._id, {
      status: cancelled.status,
      terminalStatus: cancelled.terminalStatus,
      failureReason: cancelled.failureReason,
      updatedAt: cancelled.updatedAt
    })
    await ctx.scheduler.runAfter(0, cleanupJob, { copyId: found.job.id })
    return presentProgress(cancelled, null)
  }
})

export const list = query({
  args: zodToConvexFields(campaignCopyListInputSchema.shape),
  returns: zodToConvex(campaignCopyListPageSchema),
  handler: async (ctx, args): Promise<CampaignCopyListPage> => {
    const input = campaignCopyListInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const page = await ctx.db
      .query('campaignCopyJobs')
      .withIndex('by_ownerUserId_createdAt_id', (q) => q.eq('ownerUserId', userId))
      .paginate({
        ...input.paginationOpts,
        maximumRowsRead: PAGE_SIZE,
        maximumBytesRead: MAX_BYTES
      })
    return campaignCopyListPageSchema.parse({
      ...page,
      page: page.page.map((row) => presentProgress(parseCopyJob(row), null))
    })
  }
})
