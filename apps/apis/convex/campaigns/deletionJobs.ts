import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { internalMutation } from '../lib/mutations'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { removeCampaignState } from './deletionState'
import { readCampaignLiveAuthority } from '../liveSessions/authorityGuard'
import { reconcileListingAdmission } from '../social/admissionClosure'
import { removeCampaignCharacterAssignment } from './characterDeparture'
import { syncAccountUsage } from '../lib/accountUsage'
import { scheduleSourceCopyCleanup } from './copyJobCleanup'
import { deletionCampaignScope } from './authority'
import type { LiveSessionControlInput } from '@artificer-toolkit/schema/api/liveSessions'

const args = { jobId: v.id('campaignDeletionJobs'), revision: v.number() }
type Run = { jobId: Id<'campaignDeletionJobs'>; revision: number }
const runReference = makeFunctionReference<'action', Run, null>('campaigns/deletionJobs:run')
const stepReference = makeFunctionReference<'mutation', Run, null>('campaigns/deletionJobs:step')
const failedReference = makeFunctionReference<'mutation', Run, null>(
  'campaigns/deletionJobs:failed'
)
const retryReference = makeFunctionReference<'mutation', Run, null>('campaigns/deletionJobs:retry')
const watchdogReference = makeFunctionReference<
  'mutation',
  { jobId: Id<'campaignDeletionJobs'> },
  null
>('campaigns/deletionJobs:watchdog')
const drainReference = makeFunctionReference<'query', Run, { campaignId: string } | null>(
  'campaigns/deletionJobs:drain'
)
const controlReference = makeFunctionReference<'action', LiveSessionControlInput, null>(
  'liveSessions/control:send'
)
const WATCHDOG_DELAY_MS = 60_000

export const drain = internalQuery({
  args,
  returns: v.union(v.null(), v.object({ campaignId: v.string() })),
  handler: async (ctx, input) => {
    const job = await ctx.db.get(input.jobId)
    if (
      !job ||
      job.status !== 'DELETING' ||
      job.revision !== input.revision ||
      job.stage !== 'DRAIN_ROOM'
    )
      return null
    const authority = await readCampaignLiveAuthority(ctx, job.campaignId)
    if (!authority) return null
    if (authority._id !== job.liveAuthorityId || authority.epoch !== job.liveAuthority?.epoch)
      throw new Error('Campaign deletion live authority changed.')
    return authority.phase === 'ACTIVATING' ? null : { campaignId: job.campaignId }
  }
})

export async function scheduleCampaignDeletion(
  ctx: MutationCtx,
  job: Doc<'campaignDeletionJobs'>,
  startWatchdog = false
) {
  await ctx.scheduler.runAfter(0, runReference, { jobId: job._id, revision: job.revision })
  if (startWatchdog)
    await ctx.scheduler.runAfter(WATCHDOG_DELAY_MS, watchdogReference, { jobId: job._id })
}

// Scheduled actions run at most once; this mutation keeps one recovery chain alive until deletion finishes.
export const watchdog = internalMutation({
  args: { jobId: v.id('campaignDeletionJobs') },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId)
    if (!job || job.status === 'DELETED') return null
    if (job.status === 'DELETING' && Date.now() - Date.parse(job.updatedAt) >= WATCHDOG_DELAY_MS)
      await scheduleCampaignDeletion(ctx, job)
    await ctx.scheduler.runAfter(WATCHDOG_DELAY_MS, watchdogReference, { jobId })
    return null
  }
})

export const step = internalMutation({
  args,
  returns: v.null(),
  handler: async (ctx, input) => {
    const job = await ctx.db.get(input.jobId)
    if (!job || job.status !== 'DELETING' || job.revision !== input.revision) return null
    const [capturedRoot, currentRoot] = await Promise.all([
      ctx.db.get(job.campaignRootId),
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', job.campaignId))
        .unique()
    ])
    if (job.stage !== undefined && job.stage !== 'PURGE') {
      if (
        !capturedRoot ||
        capturedRoot._id !== currentRoot?._id ||
        capturedRoot.id !== job.campaignId ||
        capturedRoot.ownerUserId !== job.ownerUserId ||
        capturedRoot.version !== job.expectedVersion
      )
        throw new Error('Campaign deletion root changed.')
      let stage: NonNullable<Doc<'campaignDeletionJobs'>['stage']> = job.stage
      const authority = await readCampaignLiveAuthority(ctx, job.campaignId)
      if (stage === 'DRAIN_ROOM') {
        if (authority) {
          if (authority._id !== job.liveAuthorityId || authority.epoch !== job.liveAuthority?.epoch)
            throw new Error('Campaign deletion live authority changed.')
          if (authority.phase !== 'ACTIVATING')
            throw new Error('Campaign deletion is waiting for live Session release.')
          await ctx.db.delete(authority._id)
        }
        stage = 'ADMISSION'
      } else {
        if (authority) throw new Error('Campaign deletion requires live Session release.')
        if (stage === 'ADMISSION') {
          const listing = await ctx.db
            .query('socialListings')
            .withIndex('by_campaignId', (q) => q.eq('campaignId', job.campaignId))
            .unique()
          if (!listing || (await reconcileListingAdmission(ctx, listing, job.createdAt, null, 8)))
            stage = 'CHARACTERS'
        } else if (stage === 'CHARACTERS') {
          const assignment = await ctx.db
            .query('campaignCharacterAssignments')
            .withIndex('by_campaignId', (q) => q.eq('campaignId', job.campaignId))
            .first()
          if (assignment) {
            await removeCampaignCharacterAssignment({
              ctx,
              campaign: capturedRoot,
              assignment,
              actorUserId: job.ownerUserId,
              reason: 'CAMPAIGN_DELETED',
              authorityScope: deletionCampaignScope(job)
            })
          } else stage = 'MEMBERSHIPS'
        } else {
          const memberships = await ctx.db
            .query('campaignMemberships')
            .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', job.campaignId))
            .take(8)
          for (const membership of memberships) await ctx.db.delete(membership._id)
          if (memberships.length === 0) {
            const route = await ctx.db
              .query('authoredRouteIds')
              .withIndex('by_subjectId', (q) => q.eq('subjectId', job.campaignId))
              .unique()
            if (
              !route ||
              route.subjectKind !== 'CAMPAIGN' ||
              route.publicId !== capturedRoot.publicId
            )
              throw new Error('Stored Campaign route mismatch.')
            await ctx.db.delete(capturedRoot._id)
            await ctx.db.delete(route._id)
            await scheduleSourceCopyCleanup(ctx, job.campaignId)
            await syncAccountUsage(ctx, 'activeHostedCampaigns', job.campaignId)
            stage = 'PURGE'
          }
        }
      }
      const next = {
        ...job,
        stage,
        revision: job.revision + 1,
        retryAttempt: 0,
        updatedAt: new Date().toISOString()
      }
      await ctx.db.patch(job._id, {
        stage: next.stage,
        revision: next.revision,
        retryAttempt: next.retryAttempt,
        updatedAt: next.updatedAt
      })
      await scheduleCampaignDeletion(ctx, next)
      return null
    }
    if (capturedRoot || currentRoot)
      throw new Error('Campaign cleanup refuses a live or recreated Campaign root.')
    // Pages stay small so no one table can exhaust a transaction, but a step keeps paging until it
    // has spent a quarter of any transaction limit: a played Campaign otherwise needs thousands of
    // scheduled steps.
    let progress = { phase: job.phase, done: false }
    do progress = await removeCampaignState(ctx, { ...job, phase: progress.phase })
    while (
      !progress.done &&
      Object.values(await ctx.meta.getTransactionMetrics()).every(
        ({ used, remaining }) => used * 3 < remaining
      )
    )
    const next = {
      ...job,
      phase: progress.phase,
      revision: job.revision + 1,
      retryAttempt: 0,
      status: progress.done ? ('DELETED' as const) : ('DELETING' as const),
      error: null,
      updatedAt: new Date().toISOString()
    }
    const { _id, _creationTime, ...stored } = next
    await ctx.db.replace(_id, stored)
    if (!progress.done) await scheduleCampaignDeletion(ctx, next)
    return null
  }
})

export const failed = internalMutation({
  args,
  returns: v.null(),
  handler: async (ctx, input) => {
    const job = await ctx.db.get(input.jobId)
    if (job?.status === 'DELETING' && job.revision === input.revision) {
      await ctx.db.patch(job._id, {
        status: 'FAILED',
        retryAttempt: Math.min((job.retryAttempt ?? 0) + 1, 6),
        error: 'Campaign cleanup failed. Retry deletion to resume.',
        updatedAt: new Date().toISOString()
      })
      // Owner-independent retries back off from one minute to one hour on persistent failures.
      await ctx.scheduler.runAfter(
        Math.min(3_600_000, 60_000 * 2 ** (job.retryAttempt ?? 0)),
        retryReference,
        input
      )
    }
    return null
  }
})

export const retry = internalMutation({
  args,
  returns: v.null(),
  handler: async (ctx, input) => {
    const job = await ctx.db.get(input.jobId)
    if (!job || job.status !== 'FAILED' || job.revision !== input.revision) return null
    const next = {
      ...job,
      status: 'DELETING' as const,
      error: null,
      revision: job.revision + 1,
      updatedAt: new Date().toISOString()
    }
    await ctx.db.patch(job._id, {
      status: next.status,
      error: next.error,
      revision: next.revision,
      updatedAt: next.updatedAt
    })
    await scheduleCampaignDeletion(ctx, next)
    return null
  }
})

// A failed page rolls back before this separate mutation records the recoverable failure.
export const run = internalAction({
  args,
  returns: v.null(),
  handler: async (ctx, input) => {
    try {
      const room = await ctx.runQuery(drainReference, input)
      if (room)
        await ctx.runAction(controlReference, { ...room, operation: { type: 'DELETE_ROOM' } })
      await ctx.runMutation(stepReference, input)
    } catch (error) {
      await ctx.runMutation(failedReference, input)
      throw error
    }
    return null
  }
})
