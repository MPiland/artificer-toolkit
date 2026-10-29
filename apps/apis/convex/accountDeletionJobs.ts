import { v } from 'convex/values'
import type { FunctionReference } from 'convex/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation } from './lib/mutations'

type AccountDeletionJob = Doc<'accountDeletionJobs'>
type AccountDeletionStep = AccountDeletionJob['step']
type StepArgs = { jobId: Id<'accountDeletionJobs'>; token: string }

/** Rows one step invocation deletes before it commits and schedules the next invocation. */
export const ACCOUNT_DELETION_BATCH = 64
const RETRY_BASE_MS = 15_000
const RETRY_CAP_MS = 60 * 60_000

export const accountDeletionStepArgs = { jobId: v.id('accountDeletionJobs'), token: v.string() }

// Each step lives in the module that owns its rows, so one invocation evaluates only that graph.
export const accountDeletionStepFunctions: Record<
  AccountDeletionStep,
  FunctionReference<'mutation', 'internal', StepArgs, null>
> = {
  CAMPAIGNS: internal.campaigns.accountDeparture.step,
  SOCIAL: internal.social.accountCleanup.prepareAccountDeletion,
  ACCOUNT: internal.accountDeletion.deleteAccount,
  MEDIA: internal.media.accountRetention.step,
  CHARACTERS: internal.characters.accountDeletion.step,
  AUTHORED: internal.content.deletion.accountDeletionStep,
  SOURCES: internal.content.accountDefinitionDeletion.step,
  FINISH: internal.accountDeletionFinish.step
}
const nextStep: Record<AccountDeletionStep, AccountDeletionStep | null> = {
  CAMPAIGNS: 'SOCIAL',
  SOCIAL: 'MEDIA',
  MEDIA: 'CHARACTERS',
  CHARACTERS: 'AUTHORED',
  AUTHORED: 'SOURCES',
  SOURCES: 'FINISH',
  FINISH: 'ACCOUNT',
  // The provider account goes last (ADR 0040); its onDelete commit retires the job.
  ACCOUNT: null
}

/** Schedules an invocation plus a retry that re-runs it unless a newer commit moved the token. */
async function dispatch(
  ctx: MutationCtx,
  jobId: Id<'accountDeletionJobs'>,
  step: AccountDeletionStep,
  token: string,
  retryAfterMs: number
) {
  await ctx.scheduler.runAfter(0, accountDeletionStepFunctions[step], { jobId, token })
  await ctx.scheduler.runAfter(retryAfterMs, internal.accountDeletionJobs.retry, { jobId, token })
}

export async function startAccountDeletion(ctx: MutationCtx, authUserId: string, userId: string) {
  if (
    await ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  )
    throw new Error('Account deletion is already scheduled.')
  const token = crypto.randomUUID()
  const jobId = await ctx.db.insert('accountDeletionJobs', {
    authUserId,
    userId,
    step: 'CAMPAIGNS',
    cursor: null,
    token,
    attempt: 0
  })
  await dispatch(ctx, jobId, 'CAMPAIGNS', token, RETRY_BASE_MS)
}

/** The job for a step invocation, or null when a newer commit already retired this token. */
export async function readAccountDeletionStep(
  ctx: MutationCtx,
  { jobId, token }: StepArgs,
  step: AccountDeletionStep
): Promise<AccountDeletionJob | null> {
  const job = await ctx.db.get(jobId)
  if (!job || job.token !== token) return null
  if (job.step !== step) throw new Error('Account deletion job step mismatch.')
  return job
}

/**
 * Commits a step's progress: it runs again from `cursor` while rows remain, else the next step
 * starts. The new token makes any duplicate or retried invocation of the old one a no-op.
 */
export async function continueAccountDeletion(
  ctx: MutationCtx,
  job: AccountDeletionJob,
  remaining: boolean,
  cursor: string | null = null
) {
  const step = remaining ? job.step : nextStep[job.step]
  if (!step) throw new Error('Account deletion job has no next step.')
  const token = crypto.randomUUID()
  await ctx.db.patch(job._id, { step, cursor: remaining ? cursor : null, token, attempt: 0 })
  await dispatch(ctx, job._id, step, token, RETRY_BASE_MS)
}

// Convex does not retry a scheduled mutation that threw or timed out; this re-runs the step.
export const retry = internalMutation({
  args: accountDeletionStepArgs,
  returns: v.null(),
  handler: async (ctx, { jobId, token }) => {
    const job = await ctx.db.get(jobId)
    if (!job || job.token !== token) return null
    const attempt = job.attempt + 1
    await ctx.db.patch(jobId, { attempt })
    await dispatch(
      ctx,
      jobId,
      job.step,
      token,
      Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_CAP_MS)
    )
    return null
  }
})
