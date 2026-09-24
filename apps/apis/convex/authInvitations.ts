import * as zMini from 'zod/mini'
import {
  authInvitationRedeemInputSchema,
  authInvitationRedeemPreparedInputSchema,
  type AuthInvitationRedeemPreparedInput
} from '@artificer-toolkit/schema/api/auth'
import { betterAuth } from 'better-auth/minimal'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './lib/mutations'
import { createAuth, createAuthOptions } from './authFactory.helper'

const issueInput = zMini.pick(authInvitationRedeemInputSchema, { email: true, token: true })

async function tokenDigest(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const issue = internalMutation({
  args: zodToConvexFields(issueInput.shape),
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { email, token } = issueInput.parse(args)
    const { internalAdapter } = await createAuth(ctx).$context
    if (await internalAdapter.findUserByEmail(email)) throw new Error('Account already exists.')
    const identifier = `account-invitation:${email}`
    await internalAdapter.deleteVerificationByIdentifier(identifier)
    await internalAdapter.createVerificationValue({
      identifier,
      value: await tokenDigest(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    })
    const actionUrl = new URL('/update-password?flow=invite', process.env.SITE_URL)
    // Fragment credentials are not sent in HTTP requests, server logs, or Referer headers.
    actionUrl.hash = new URLSearchParams({ email, token }).toString()
    await ctx.scheduler.runAfter(0, internal.email.send, {
      action: 'invite',
      recipient: email,
      actionUrl: actionUrl.href
    })
    return null
  }
})

export const redeem = internalMutation({
  args: zodToConvexFields(authInvitationRedeemPreparedInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args: AuthInvitationRedeemPreparedInput): Promise<null> => {
    const input = authInvitationRedeemPreparedInputSchema.parse(args)
    const options = createAuthOptions(ctx)
    const { internalAdapter } = await createAuth(ctx).$context
    const identifier = `account-invitation:${input.email}`
    const invitation = await internalAdapter.findVerificationValue(identifier)
    if (
      !invitation ||
      !(Number(invitation.expiresAt) > Date.now()) ||
      invitation.value !== (await tokenDigest(input.token)) ||
      (await internalAdapter.findUserByEmail(input.email))
    ) {
      throw new Error('Invalid or expired invitation.')
    }

    // Only this token-authorized mutation bypasses closed signup. The public provider
    // options never change. Reuse its username policy and user hooks.
    const invitedAuth = betterAuth({
      ...options,
      emailAndPassword: {
        ...options.emailAndPassword,
        disableSignUp: false,
        autoSignIn: false,
        password: {
          hash: async () => input.passwordHash
        }
      },
      emailVerification: { ...options.emailVerification, sendOnSignUp: false }
    })
    const created = await invitedAuth.api.signUpEmail({
      body: {
        email: input.email,
        username: input.username,
        name: input.username,
        password: input.password
      }
    })
    // Email possession was proven by the invitation, not by a client emailVerified flag.
    await internalAdapter.updateUser(created.user.id, { emailVerified: true })
    await internalAdapter.deleteVerificationByIdentifier(identifier)
    // No session is issued. User signs in normally after committing setup. Nested
    // component writes, profile creation and token consumption share this transaction.
    return null
  }
})
