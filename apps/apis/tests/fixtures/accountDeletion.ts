import type { FunctionReference } from 'convex/server'
import type { TestConvex } from 'convex-test'
import { vi } from 'vitest'
import { internal } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import {
  accountDeletionStepFunctions,
  startAccountDeletion
} from '../../convex/accountDeletionJobs'
import type schema from '../../convex/schema'

/**
 * Runs scheduled work to completion on fake timers, so the staged account deletion's retry
 * watchdogs (ADR 0040) fire and retire instead of leaving the drain waiting on a real clock. It
 * advances one timer at a time: firing every timer at once starts a step's watchdog before the
 * step commits, and each lost race doubles the backoff, carrying the clock past session expiries.
 */
export async function drainScheduledWork(t: TestConvex<typeof schema>) {
  const realTimers = !vi.isFakeTimers()
  if (realTimers) vi.useFakeTimers({ now: Date.now() })
  try {
    await t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer(), 1_000)
  } finally {
    if (realTimers) vi.useRealTimers()
  }
}

/**
 * Invokes one step of an account's scheduled deletion job directly, without draining what it
 * schedules, so a test can observe that step's commit or failure on its own.
 */
export async function runAccountDeletionStep(
  t: TestConvex<typeof schema>,
  userId: string,
  step: FunctionReference<
    'mutation',
    'internal',
    { jobId: Id<'accountDeletionJobs'>; token: string },
    null
  >
) {
  const job = await t.run((ctx) =>
    ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
  )
  if (!job) throw new Error('No account deletion job is scheduled.')
  return t.mutation(step, { jobId: job._id, token: job.token })
}

/**
 * Invokes each step of an account's deletion job directly until the job reaches `stop`, or retires
 * when `stop` is null, leaving every other scheduled function pending for the test to drive.
 */
export async function advanceAccountDeletion(
  t: TestConvex<typeof schema>,
  userId: string,
  stop: Doc<'accountDeletionJobs'>['step'] | null
) {
  for (let invocation = 0; invocation < 1_000; invocation++) {
    const job = await t.run((ctx) =>
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
    )
    if (!job) {
      if (stop === null) return
      throw new Error(`Account deletion retired before ${stop}.`)
    }
    if (job.step === stop) return
    await t.mutation(accountDeletionStepFunctions[job.step], { jobId: job._id, token: job.token })
  }
  throw new Error('Account deletion did not finish.')
}

/**
 * Starts an account's staged deletion and runs every step before the provider account, so a test
 * can drive the provider delete trigger itself. Returns the work scheduled so far.
 */
export async function advanceAccountDeletionToProvider(
  t: TestConvex<typeof schema>,
  authUserId: string,
  userId: string
) {
  await t.run((ctx) => startAccountDeletion(ctx, authUserId, userId))
  await advanceAccountDeletion(t, userId, 'ACCOUNT')
  return new Set(
    (await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).map(
      (row) => row._id
    )
  )
}

/** Names and outcomes of the functions scheduled since `before`, in scheduling order. */
export async function scheduledSince(t: TestConvex<typeof schema>, before: ReadonlySet<string>) {
  return (await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect()))
    .filter((row) => !before.has(row._id))
    .map((row) => ({ name: row.name, state: row.state.kind }))
}

/** Schedules an account's staged deletion and invokes each step directly until the job retires. */
export async function runAccountDeletionInPlace(
  t: TestConvex<typeof schema>,
  authUserId: string,
  userId: string
) {
  await t.mutation(internal.accountDeletion.schedule, { authUserId })
  await advanceAccountDeletion(t, userId, null)
}

/**
 * Throws when an account's deletion job survived a drain: a step that keeps failing retries until
 * the drain gives up, and its backoff carries the fake clock past every other session's expiry.
 */
export async function assertAccountDeletionRetired(
  t: TestConvex<typeof schema>,
  authUserId: string
) {
  const { job, failed } = await t.run(async (ctx) => ({
    job: await ctx.db
      .query('accountDeletionJobs')
      .filter((q) => q.eq(q.field('authUserId'), authUserId))
      .first(),
    failed: (await ctx.db.system.query('_scheduled_functions').collect()).flatMap((row) =>
      row.state.kind === 'failed' ? [`${row.name}: ${row.state.error}`] : []
    )
  }))
  if (job)
    throw new Error(
      `Account deletion stopped at ${job.step} after ${job.attempt} retries. ${failed.slice(-3).join(' | ')}`
    )
}

/** Schedules an account's staged deletion and runs every step, as the production scheduler does. */
export async function deleteAccountCompletely(t: TestConvex<typeof schema>, authUserId: string) {
  await t.mutation(internal.accountDeletion.schedule, { authUserId })
  await drainScheduledWork(t)
  await assertAccountDeletionRetired(t, authUserId)
}
