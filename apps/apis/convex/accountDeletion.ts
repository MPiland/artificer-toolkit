import {
  accountDeleteInputSchema,
  type AccountDeleteInput
} from '@artificer-toolkit/schema/api/account'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { createAuth } from './authFactory.helper'
import { getAuthenticatedProfile } from './lib/identity'
import { readAuthUser } from './lib/authUserReads'
import { internalMutation } from './lib/mutations'

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
    // Provider credentials, every session, app cleanup and deferred jobs share this transaction.
    await auth.internalAdapter.deleteUser(current.user.id)
    return null
  }
})
