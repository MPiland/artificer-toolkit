import { TRPCError } from '@trpc/server'
import {
  USERNAME_NOT_ALLOWED_MESSAGE,
  validateUsername
} from '@artificer-toolkit/shared/account/username'
import { createAccountProfileRepository } from '@artificer-toolkit/db'
import { getEntitlementProjection } from '@artificer-toolkit/functions'
import { createSupabaseClient } from '@artificer-toolkit/functions/clients'
import {
  authInvitationCompletionInputSchema,
  authSessionCredentialsDtoSchema,
  authUsernameSignInInputSchema
} from '@artificer-toolkit/schema/api/auth'
import { applicationFeatureFlagsDtoSchema } from '@artificer-toolkit/schema/api/applicationConfig'
import {
  accountProfileDtoSchema,
  accountProfileUpdateInputSchema,
  accountUsernameStatusDtoSchema,
  accountUsernameStatusInputSchema
} from '@artificer-toolkit/schema/api/account'
import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import { requireUserId, withAuthenticatedDb, withDb, withExplicitAuthorityDb } from './dbContext.js'
import { getApplicationFeatureFlags } from '../applicationConfig.js'

import {
  authenticatedProcedure,
  createTRPCRouter,
  okResponseSchema,
  publicProcedure
} from './procedures.js'

function hasStatus429(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 429
}

function toUnexpectedAuthError(error: unknown, preserveRateLimit = false): TRPCError {
  if (error instanceof TRPCError) {
    return error
  }

  if (preserveRateLimit && hasStatus429(error)) {
    return new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many sign-in attempts. Try again shortly.',
      cause: error
    })
  }

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal Server Error',
    cause: error
  })
}

export const applicationRouter = createTRPCRouter({
  featureFlags: publicProcedure
    .output(applicationFeatureFlagsDtoSchema)
    .query(() => getApplicationFeatureFlags())
})

export const accountRouter = createTRPCRouter({
  usernameStatus: publicProcedure
    .input(accountUsernameStatusInputSchema)
    .output(accountUsernameStatusDtoSchema)
    .query(({ ctx, input }) => {
      const validation = validateUsername(input.username)
      if (validation.message) {
        return { status: 'not_allowed' as const }
      }

      return withDb(ctx, async (db) => ({
        status: (await createAccountProfileRepository(db).isUsernameTaken(validation.username))
          ? ('taken' as const)
          : ('available' as const)
      }))
    }),

  signInWithUsername: publicProcedure
    .input(authUsernameSignInInputSchema)
    .output(authSessionCredentialsDtoSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = await withDb(ctx, (db) =>
          createAccountProfileRepository(db).findUserIdByUsername(input.username)
        )
        if (!userId) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid username or password.' })
        }

        const supabase = createSupabaseClient(ctx.clientIp)
        const { data: authUser, error: authUserError } =
          await supabase.auth.admin.getUserById(userId)
        const email = authUser.user?.email
        if (authUserError || !email) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid username or password.' })
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: input.password
        })
        if (error?.status === 429) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many sign-in attempts. Try again shortly.'
          })
        }
        if (error || !data.session) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid username or password.' })
        }

        return {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token
        }
      } catch (error) {
        throw toUnexpectedAuthError(error, true)
      }
    }),

  completeInvitation: publicProcedure
    .input(authInvitationCompletionInputSchema)
    .output(okResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = requireUserId(ctx)
        if (!ctx.invitationSetupPending) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Invitation setup is already complete.'
          })
        }
        const supabase = createSupabaseClient()
        const { data: authUser, error: authUserError } =
          await supabase.auth.admin.getUserById(userId)
        if (authUserError || !authUser.user) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not complete registration.'
          })
        }

        const username = validateUsername(input.username)
        if (username.message) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: USERNAME_NOT_ALLOWED_MESSAGE
          })
        }

        const existingProfile = await withDb(ctx, (db) =>
          createAccountProfileRepository(db).findForUser(userId)
        )
        await withDb(ctx, (db) =>
          createAccountProfileRepository(db).upsertForUser(userId, {
            username: username.username,
            bio: existingProfile?.bio ?? null
          })
        )

        const { error } = await supabase.auth.admin.updateUserById(userId, {
          password: input.password,
          app_metadata: {
            ...authUser.user.app_metadata,
            registration_completed: true
          }
        })
        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not complete registration.'
          })
        }

        return { ok: true as const }
      } catch (error) {
        throw toUnexpectedAuthError(error)
      }
    }),

  profile: authenticatedProcedure
    .output(accountProfileDtoSchema.nullable())
    .query(({ ctx }) =>
      withAuthenticatedDb(ctx, async (db, userId) =>
        createAccountProfileRepository(db).findForUser(userId)
      )
    ),

  updateProfile: authenticatedProcedure
    .input(accountProfileUpdateInputSchema)
    .output(accountProfileDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) => {
        const repository = createAccountProfileRepository(db)
        const profile = await repository.findForUser(userId)
        let username = profile?.username ?? null

        if (input.username) {
          const validation = validateUsername(input.username)
          if (validation.message) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: USERNAME_NOT_ALLOWED_MESSAGE
            })
          }
          username = validation.username
        } else if (!username) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: USERNAME_NOT_ALLOWED_MESSAGE
          })
        }

        return repository.upsertForUser(userId, {
          username,
          bio: input.bio
        })
      })
    ),

  entitlements: authenticatedProcedure
    .output(campaignContracts.entitlementProjectionDtoSchema)
    .query(({ ctx }) =>
      withExplicitAuthorityDb(ctx, async (db, userId) => getEntitlementProjection(db, userId))
    )
})
