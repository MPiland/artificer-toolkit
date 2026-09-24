import { v } from 'convex/values'
import {
  authSessionSnapshotDtoSchema,
  setAuthoringExperienceInputSchema,
  type AuthSessionSnapshotDto
} from '@artificer-toolkit/schema/api/auth'
import {
  accountProfileDtoSchema,
  type AccountProfileDto
} from '@artificer-toolkit/schema/api/account'
import { query } from './_generated/server'
import { components, internal } from './_generated/api'
import { mutation } from './lib/mutations'
import { getAuthenticatedProfile, requireIdentity } from './lib/identity'
import { readApplicationFeatureFlags } from './application'
import { readAuthUser } from './lib/authUserReads'

const profileResult = v.object({
  username: v.union(v.null(), v.string()),
  bio: v.union(v.null(), v.string())
})

export const profile = query({
  args: {},
  returns: profileResult,
  handler: async (ctx): Promise<AccountProfileDto> => {
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    return accountProfileDtoSchema.parse({
      username: authenticated.username,
      bio: authenticated.profile.bio
    })
  }
})

export const updateProfile = mutation({
  args: { username: v.optional(v.string()), bio: v.union(v.null(), v.string()) },
  returns: profileResult,
  handler: async (ctx, args): Promise<AccountProfileDto> =>
    ctx.runMutation(internal.accountProfileCommands.update, args)
})

export const identity = query({
  args: {},
  returns: v.object({
    userId: v.string(),
    role: v.union(v.literal('user'), v.literal('superadmin'))
  }),
  handler: async (ctx) => await requireIdentity(ctx)
})

export const session = query({
  args: {},
  returns: v.object({
    user: v.union(
      v.null(),
      v.object({
        userId: v.string(),
        email: v.string(),
        username: v.union(v.null(), v.string()),
        role: v.union(v.literal('user'), v.literal('superadmin')),
        registrationCompleted: v.boolean(),
        authoringExperience: v.union(v.literal('guided'), v.literal('advanced'))
      })
    ),
    featureFlags: v.object({ libraryImportEnabled: v.boolean(), publicSignUpEnabled: v.boolean() }),
    isSuperAdmin: v.boolean()
  }),
  handler: async (ctx): Promise<AuthSessionSnapshotDto> => {
    const identity = await ctx.auth.getUserIdentity()
    let user: AuthSessionSnapshotDto['user'] = null
    if (identity && typeof identity.sessionId === 'string') {
      const [session, authUser, profile] = await Promise.all([
        ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: 'session',
          where: [
            { field: '_id', value: identity.sessionId },
            { field: 'expiresAt', operator: 'gt', value: Date.now() }
          ]
        }),
        readAuthUser(ctx, identity.subject),
        ctx.db
          .query('userProfiles')
          .withIndex('by_authUserId', (query) => query.eq('authUserId', identity.subject))
          .unique()
      ])
      if (session?.userId === identity.subject && authUser) {
        if (authUser.banned && (!authUser.banExpires || authUser.banExpires >= Date.now())) {
          user = null
        } else {
          if (!profile) throw new Error('Authenticated user profile is missing.')
          const role = authUser.role ?? 'user'
          if (role !== 'user' && role !== 'superadmin')
            throw new Error('Authenticated user has an unsupported role.')
          user = {
            userId: profile.userId,
            role,
            email: authUser.email,
            username: authUser.displayUsername ?? authUser.username ?? null,
            registrationCompleted: profile.registrationCompleted ?? true,
            authoringExperience: profile.authoringExperience ?? 'guided'
          }
        }
      }
    }
    return authSessionSnapshotDtoSchema.parse({
      user,
      featureFlags: readApplicationFeatureFlags(),
      isSuperAdmin: user?.role === 'superadmin'
    })
  }
})

export const setAuthoringExperience = mutation({
  args: { experience: v.union(v.literal('guided'), v.literal('advanced')) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = setAuthoringExperienceInputSchema.parse(args)
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    await ctx.db.patch(authenticated.profile._id, { authoringExperience: input.experience })
    return null
  }
})
