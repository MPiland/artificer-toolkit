import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { parseCopyJob } from './copyJobs'
import { campaignStoredNotebookSectionSchema } from '@artificer-toolkit/schema/projections/campaignNotebookPersistence'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'

const cleanupJob = makeFunctionReference<'mutation', { copyId: string }, null>(
  'campaigns/copyJobCleanup:cleanup'
)
const PAGE_SIZE = 8

async function enqueue(ctx: MutationCtx, copyId: string) {
  await ctx.scheduler.runAfter(0, cleanupJob, { copyId })
}

export async function scheduleSourceCopyCleanup(ctx: MutationCtx, campaignId: string) {
  const source = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaignId))
    .unique()
  if (source) return
  const jobs = await ctx.db
    .query('campaignCopyJobs')
    .withIndex('by_sourceCampaignId_id', (q) => q.eq('command.campaignId', campaignId))
    .take(1)
  if (jobs[0]) await enqueue(ctx, jobs[0].id)
}
export async function scheduleOwnerCopyCleanup(ctx: MutationCtx, userId: string) {
  if (
    await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
  )
    return
  const jobs = await ctx.db
    .query('campaignCopyJobs')
    .withIndex('by_ownerUserId_createdAt_id', (q) => q.eq('ownerUserId', userId))
    .take(1)
  if (jobs[0]) await enqueue(ctx, jobs[0].id)
}

export const cleanup = internalMutation({
  args: { copyId: v.string() },
  returns: v.null(),
  handler: async (ctx, { copyId }) => {
    const row = await ctx.db
      .query('campaignCopyJobs')
      .withIndex('by_publicId', (q) => q.eq('id', copyId))
      .unique()
    if (!row) return null
    const job = parseCopyJob(row)
    const [source, profile, destination] = await Promise.all([
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', job.command.campaignId))
        .unique(),
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', job.ownerUserId))
        .unique(),
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', job.destinationCampaignId))
        .unique()
    ])
    const lifecycleSweep = !source || !profile
    if (!lifecycleSweep && job.status === 'RUNNING') {
      if (Date.now() < job.expiresAt) return null
      await ctx.db.patch(row._id, {
        status: 'CLEANING',
        terminalStatus: 'FAILED',
        failureReason: 'Copy could not be completed.',
        updatedAt: new Date().toISOString()
      })
      await enqueue(ctx, job.id)
      return null
    }
    if (
      !lifecycleSweep &&
      (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED')
    )
      return null
    if (destination) {
      if (!lifecycleSweep || job.status !== 'COMPLETED')
        throw new Error('Campaign copy cleanup found an unexpected destination.')
      await ctx.db.delete(row._id)
      if (!source) await scheduleSourceCopyCleanup(ctx, job.command.campaignId)
      if (!profile) await scheduleOwnerCopyCleanup(ctx, job.ownerUserId)
      return null
    }
    const sections = await ctx.db
      .query('campaignNotebookSections')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', job.destinationCampaignId))
      .take(PAGE_SIZE)
    for (const section of sections) {
      const { _id, _creationTime, ...stored } = section
      const validated = campaignStoredNotebookSectionSchema.parse(stored)
      if (
        validated.campaignId !== job.destinationCampaignId ||
        validated.authorUserId !== job.ownerUserId ||
        validated.updatedBy !== job.ownerUserId
      )
        throw new Error('Campaign copy staging integrity failure.')
      await ctx.db.delete(section._id)
    }
    if (sections.length === PAGE_SIZE) {
      await enqueue(ctx, job.id)
      return null
    }
    if (lifecycleSweep) {
      await ctx.db.delete(row._id)
      if (!source) await scheduleSourceCopyCleanup(ctx, job.command.campaignId)
      if (!profile) await scheduleOwnerCopyCleanup(ctx, job.ownerUserId)
      return null
    }
    const terminal = job.terminalStatus ?? 'FAILED'
    await ctx.db.patch(row._id, {
      status: terminal,
      terminalStatus: terminal,
      updatedAt: new Date().toISOString()
    })
    return null
  }
})
