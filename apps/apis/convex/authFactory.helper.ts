import type { GenericCtx } from '@convex-dev/better-auth'
import {
  authClientIpSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  authInvitationRedeemInputSchema,
  authRecoveryCommandSchema,
  type AuthRecoveryResult,
  usernameInputSchema
} from '@artificer-toolkit/schema/api/auth'
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal'
import { verifyJWT } from 'better-auth/crypto'
import {
  APIError,
  changePassword,
  sensitiveSessionMiddleware,
  createAuthEndpoint,
  createAuthMiddleware,
  formCsrfMiddleware
} from 'better-auth/api'
import {
  accountDeleteInputSchema,
  accountPasswordUpdateInputSchema,
  type AccountDeleteInput
} from '@artificer-toolkit/schema/api/account'
import { USERNAME_NOT_ALLOWED_MESSAGE } from '@artificer-toolkit/shared/account/username'
import { validateUsernameOnServer } from '@artificer-toolkit/shared/account/usernameServer'
import { deleteSessionCookie } from 'better-auth/cookies'
import { JWT_COOKIE_NAME } from '@convex-dev/better-auth/plugins'
import { makeFunctionReference } from 'convex/server'
import { internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { verifyAuthProxyContext } from './lib/authProxyContext'
import { authComponent } from './lib/authClient.helper'
import { createAuthAdapterOptions } from './betterAuth/options'

function requiredEnvironmentVariable(name: 'SITE_URL' | 'BETTER_AUTH_SECRET'): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} must be configured.`)
  }

  return value
}

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
  const siteUrl = process.env.SITE_URL
  const adapterOptions = createAuthAdapterOptions(async ({ email, otp, type }) => {
    if (type !== 'forget-password') throw new Error('Only password recovery OTP is supported.')
    if (!('scheduler' in ctx)) throw new Error('Email requires an action or mutation context.')
    const actionUrl = new URL('/verify-password-reset', requiredEnvironmentVariable('SITE_URL'))
    actionUrl.searchParams.set('email', email)
    await ctx.scheduler.runAfter(0, internal.email.send, {
      action: 'recovery',
      recipient: email,
      actionUrl: actionUrl.href,
      token: otp
    })
  })
  return {
    ...adapterOptions,
    baseURL: siteUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: siteUrl ? [siteUrl] : [],
    database: authComponent.adapter(ctx),
    advanced: {
      disableOriginCheck: false,
      ipAddress: { ipAddressHeaders: ['x-artificer-client-ip'] }
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if ('runAction' in ctx && context.path?.startsWith('/email-otp/')) {
          const operation =
            context.path === '/email-otp/request-password-reset'
              ? 'REQUEST'
              : context.path === '/email-otp/check-verification-otp'
                ? 'CHECK'
                : context.path === '/email-otp/reset-password'
                  ? 'RESET'
                  : null
          if (operation) {
            if (operation === 'CHECK' && context.body?.type !== 'forget-password') {
              throw new APIError('BAD_REQUEST', {
                message: 'Only password recovery OTP is supported.'
              })
            }
            const command = authRecoveryCommandSchema.safeParse({
              operation,
              email: context.body?.email,
              ...(operation !== 'REQUEST' ? { token: context.body?.otp } : {}),
              ...(operation === 'RESET' ? { password: context.body?.password } : {})
            })
            if (!command.success)
              throw new APIError('BAD_REQUEST', {
                message: 'Invalid recovery request.'
              })
            const result: AuthRecoveryResult = await ctx.runMutation(
              internal.authRecovery.execute,
              { command: command.data }
            )
            if (!result.success) {
              return context.json(
                { code: result.code, message: result.message },
                { status: result.status }
              )
            }
            return context.json({ success: true })
          }
        }
        if (
          context.path === '/sign-up/email' &&
          !usernameInputSchema.safeParse(context.body?.username).success
        ) {
          throw new APIError('BAD_REQUEST', {
            message: 'A valid username is required.'
          })
        }
        // Moderation applies when a name is chosen (sign-up, rename), never when it is typed to sign in.
        if (context.path === '/sign-up/email' || context.path === '/update-user') {
          for (const name of [context.body?.username, context.body?.displayUsername]) {
            if (typeof name === 'string' && validateUsernameOnServer(name).message !== null) {
              throw new APIError('BAD_REQUEST', {
                message: USERNAME_NOT_ALLOWED_MESSAGE,
                code: 'INVALID_USERNAME'
              })
            }
          }
        }
      })
    },
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, url }) => {
          if (!('scheduler' in ctx))
            throw new Error('Email requires an action or mutation context.')
          const actionUrl = new URL(url)
          actionUrl.searchParams.set(
            'callbackURL',
            new URL('/settings/account?emailChanged=1', requiredEnvironmentVariable('SITE_URL'))
              .href
          )
          await ctx.scheduler.runAfter(0, internal.email.send, {
            action: 'email_change',
            recipient: user.email,
            actionUrl: actionUrl.href
          })
        }
      }
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url, token }) => {
        if (!('scheduler' in ctx)) throw new Error('Email requires an action or mutation context.')
        const payload = await verifyJWT<unknown>(
          token,
          requiredEnvironmentVariable('BETTER_AUTH_SECRET')
        )
        const isEmailChangeVerification =
          typeof payload === 'object' &&
          payload !== null &&
          'requestType' in payload &&
          payload.requestType === 'change-email-verification'
        const actionUrl = new URL(url)
        actionUrl.searchParams.set(
          'callbackURL',
          new URL(
            isEmailChangeVerification ? '/settings/account?emailChanged=1' : '/auth/confirmed',
            requiredEnvironmentVariable('SITE_URL')
          ).href
        )
        await ctx.scheduler.runAfter(0, internal.email.send, {
          action: isEmailChangeVerification ? 'email_change' : 'signup',
          recipient: user.email,
          actionUrl: actionUrl.href
        })
      }
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: process.env.PUBLIC_SIGN_UP_ENABLED !== 'true',
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH
    },
    plugins: [
      {
        id: 'account-password',
        endpoints: {
          updateAccountPassword: createAuthEndpoint(
            '/account/password',
            {
              method: 'POST',
              body: accountPasswordUpdateInputSchema,
              use: [formCsrfMiddleware, sensitiveSessionMiddleware]
            },
            async (context) => {
              if (
                context.body.email.toLowerCase() !==
                context.context.session.user.email.toLowerCase()
              )
                throw new APIError('BAD_REQUEST', {
                  message: 'Your account email has changed. Refresh and try again.'
                })
              await changePassword({
                context: context.context,
                headers: context.headers,
                body: {
                  currentPassword: context.body.currentPassword,
                  newPassword: context.body.password,
                  revokeOtherSessions: false
                }
              })
              return context.json(null)
            }
          )
        }
      },
      {
        id: 'account-deletion',
        endpoints: {
          deleteAccount: createAuthEndpoint(
            '/account/delete',
            {
              method: 'POST',
              body: accountDeleteInputSchema,
              use: [formCsrfMiddleware, sensitiveSessionMiddleware]
            },
            async (context) => {
              if (!('runAction' in ctx))
                throw new Error('Account deletion HTTP requires an action.')
              const execute = makeFunctionReference<
                'mutation',
                { sessionToken: string; command: AccountDeleteInput },
                null
              >('accountDeletion:execute')
              try {
                await ctx.runMutation(execute, {
                  sessionToken: context.context.session.session.token,
                  command: context.body
                })
              } catch (error) {
                const message = error instanceof Error ? error.message : ''
                if (message.includes('Account deletion is restricted by owned Campaigns.'))
                  throw new APIError('BAD_REQUEST', {
                    message: 'Transfer or delete your Campaigns before deleting your account.'
                  })
                if (message.includes('The current password is incorrect.'))
                  throw new APIError('BAD_REQUEST', {
                    message: 'The current password is incorrect.'
                  })
                if (message.includes('Enter the email address for this account.'))
                  throw new APIError('BAD_REQUEST', {
                    message: 'Enter the email address for this account.'
                  })
                if (message.includes('Unauthenticated'))
                  throw new APIError('UNAUTHORIZED', {
                    message: 'Your session has expired. Sign in and try again.'
                  })
                throw error
              }
              // Cookies expire only after the complete native mutation commits.
              deleteSessionCookie(context)
              const jwt = context.context.createAuthCookie(JWT_COOKIE_NAME, { maxAge: 0 })
              context.setCookie(jwt.name, '', jwt.attributes)
              return context.json(null)
            }
          )
        }
      },
      {
        id: 'account-invitations',
        endpoints: {
          redeemInvitation: createAuthEndpoint(
            '/invitation/redeem',
            {
              method: 'POST',
              body: authInvitationRedeemInputSchema,
              use: [formCsrfMiddleware]
            },
            async (context) => {
              if (!('runAction' in ctx)) throw new Error('Invitation HTTP requires an action.')
              try {
                await ctx.runAction(internal.authInvitationActions.redeem, context.body)
              } catch {
                throw new APIError('BAD_REQUEST', {
                  message: 'Invitation is invalid or expired, or the username is unavailable.'
                })
              }
              return context.json({ success: true })
            }
          )
        }
      },

      ...adapterOptions.plugins
    ]
  } satisfies BetterAuthOptions
}

// Better Auth's router applies its rate limit before any plugin `onRequest` hook, so the limiter
// identity must be on the request before the handler runs. Only platform metadata or the signed SSR
// proxy context may supply it; a caller's own `x-artificer-client-ip` is always overwritten.
async function withClientIp(ctx: GenericCtx<DataModel>, request: Request) {
  if (!('runAction' in ctx)) throw new Error('Auth HTTP requires an action context.')
  let proxyContext
  try {
    proxyContext = await verifyAuthProxyContext(request, process.env.CONVEX_SITE_URL ?? '')
  } catch (error) {
    // The failed check (jose error name and message) is logged, never the token or secret.
    console.error(
      'Auth proxy context rejected:',
      error instanceof Error ? `${error.name}: ${error.message}` : 'unknown failure'
    )
    return new Response('Invalid authentication request.', { status: 400 })
  }
  const ip = authClientIpSchema.safeParse(
    proxyContext?.ip ?? (await ctx.meta.getRequestMetadata()).ip
  )
  if (!ip.success) {
    // Better Auth would otherwise put every such caller in one shared per-path bucket.
    console.error(
      'Auth request refused: no valid client IP, so rate limiting cannot key on the client.'
    )
    return new Response('Authentication unavailable.', { status: 503 })
  }
  const headers = new Headers(request.headers)
  headers.set('x-artificer-client-ip', ip.data)
  return new Request(request, { headers })
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  requiredEnvironmentVariable('SITE_URL')
  requiredEnvironmentVariable('BETTER_AUTH_SECRET')
  const auth = betterAuth(createAuthOptions(ctx))
  return {
    ...auth,
    handler: async (request: Request) => {
      const identified = await withClientIp(ctx, request)
      return identified instanceof Response ? identified : auth.handler(identified)
    }
  }
}
