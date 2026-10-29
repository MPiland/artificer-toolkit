import {
  accountDeleteInputSchema,
  type AccountDeleteInput
} from '@artificer-toolkit/schema/api/account'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { components } from './_generated/api'
import { createAuth } from './authFactory.helper'
import { getAuthenticatedProfile } from './lib/identity'
import { readAuthUser } from './lib/authUserReads'
import { internalMutation } from './lib/mutations'
import type { MutationCtx } from './_generated/server'
import {
  accountDeletionStepArgs,
  readAccountDeletionStep,
  startAccountDeletion
} from './accountDeletionJobs'

export const confirmCredentials = internalMutation({
  args: { email: v.string(), currentPassword: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = accountDeleteInputSchema.parse(args)
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    if (input.email.toLowerCase() !== authenticated.email.toLowerCase())
      throw new Error('Enter the email address for this account.')

    const auth = await createAuth(ctx).$context
    await verifyCredentials(auth, authenticated.profile.authUserId, input)
    return null
  }
})
async function verifyCredentials(
  auth: Awaited<ReturnType<typeof createAuth>['$context']>,
  authUserId: string,
  input: AccountDeleteInput
) {
  const credentials = (await auth.internalAdapter.findAccounts(authUserId)).filter(
    (account) => account.providerId === 'credential'
  )
  if (
    credentials.length !== 1 ||
    !credentials[0]!.password ||
    !(await auth.password.verify({
      hash: credentials[0]!.password,
      password: input.currentPassword
    }))
  )
    throw new Error('The current password is incorrect.')
}

// The HTTP endpoint supplies its server-derived cookie session token, never an actor ID.
export const execute = internalMutation({
  args: { sessionToken: v.string(), command: zodToConvex(accountDeleteInputSchema) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = accountDeleteInputSchema.parse(args.command)
    const auth = await createAuth(ctx).$context
    const current = await auth.internalAdapter.findSession(args.sessionToken)
    const expiresAt = Number(current?.session.expiresAt)
    if (
      !current ||
      current.session.token !== args.sessionToken ||
      current.session.userId !== current.user.id ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    )
      throw new Error('Unauthenticated')
    const authUser = await readAuthUser(ctx, current.user.id)
    if (
      !authUser ||
      (authUser.banned && (!authUser.banExpires || authUser.banExpires >= Date.now()))
    )
      throw new Error('Unauthenticated')
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_authUserId', (q) => q.eq('authUserId', current.user.id))
      .unique()
    if (!profile) throw new Error('Authenticated user profile is missing.')
    if (input.email.toLowerCase() !== authUser.email.toLowerCase())
      throw new Error('Enter the email address for this account.')
    await verifyCredentials(auth, current.user.id, input)
    await scheduleAccountDeletion(ctx, current.user.id, profile.userId)
    return null
  }
})

/**
 * Signs the account out everywhere and starts its staged deletion (ADR 0040). An owner is refused
 * here, synchronously, because the job could never pass the owned-Campaign gate.
 */
async function scheduleAccountDeletion(ctx: MutationCtx, authUserId: string, userId: string) {
  if (
    await ctx.db
      .query('campaigns')
      .withIndex('by_ownerUserId_status', (q) => q.eq('ownerUserId', userId))
      .first()
  )
    throw new Error('Account deletion is restricted by owned Campaigns.')
  await deleteProviderRows(ctx, 'session', authUserId)
  await deleteProviderRows(ctx, 'account', authUserId)
  await startAccountDeletion(ctx, authUserId, userId)
}

/** Revokes the account's provider sessions or credentials; an account holds only a few of each. */
async function deleteProviderRows(
  ctx: MutationCtx,
  model: 'session' | 'account',
  authUserId: string
) {
  let cursor: string | null = null
  do {
    const page: unknown = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model, where: [{ field: 'userId', value: authUserId }] },
      paginationOpts: { cursor, numItems: 100 }
    })
    if (typeof page !== 'object' || page === null || !('isDone' in page))
      throw new Error('Invalid provider deletion page.')
    cursor =
      page.isDone || !('continueCursor' in page) || typeof page.continueCursor !== 'string'
        ? null
        : page.continueCursor
  } while (cursor)
}

/** Operator and development-fixture entry point: the same staged deletion without a session. */
export const schedule = internalMutation({
  args: { authUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { authUserId }) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_authUserId', (q) => q.eq('authUserId', authUserId))
      .unique()
    // A provider account without a profile owns no application rows.
    if (!profile) await (await createAuth(ctx).$context).internalAdapter.deleteUser(authUserId)
    else await scheduleAccountDeletion(ctx, authUserId, profile.userId)
    return null
  }
})

export const deleteAccount = internalMutation({
  args: accountDeletionStepArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await readAccountDeletionStep(ctx, args, 'ACCOUNT')
    if (!job) return null
    // The provider delete runs `auth:onDelete` in this transaction, which retires the job.
    await (await createAuth(ctx).$context).internalAdapter.deleteUser(job.authUserId)
    if (await ctx.db.get(job._id))
      throw new Error('Account deletion did not reach the provider account.')
    return null
  }
})
