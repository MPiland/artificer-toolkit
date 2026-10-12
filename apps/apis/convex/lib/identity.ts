import {
  authIdentityDtoSchema,
  type AuthIdentityDto
} from '@artificer-toolkit/schema/api/authIdentity'
import type { ProfileVisibilityDto } from '@artificer-toolkit/schema/api/account'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  isAuthUserBanned,
  readAuthenticatedAuthUser,
  readAuthUserByUsername
} from './authUserReads'

/** A profile with no stored choice is PRIVATE. Every profile read path goes through this. */
export function readProfileVisibility(
  profile: Pick<Doc<'userProfiles'>, 'profileVisibility'>
): ProfileVisibilityDto {
  return profile.profileVisibility ?? 'PRIVATE'
}

/**
 * Resolves another account's profile by username for a signed-in viewer. Unknown, banned and
 * not-visible targets all return null so callers cannot tell them apart. The owner always sees
 * their own profile.
 */
export async function readViewableProfileByUsername(ctx: QueryCtx | MutationCtx, username: string) {
  const viewer = await getAuthenticatedProfile(ctx)
  if (!viewer) throw new Error('Unauthenticated')
  const authUser = await readAuthUserByUsername(ctx, username)
  if (!authUser || isAuthUserBanned(authUser)) return null
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_authUserId', (query) => query.eq('authUserId', authUser._id))
    .unique()
  if (!profile) return null
  const isOwner = profile.userId === viewer.identity.userId
  if (!isOwner && readProfileVisibility(profile) !== 'PUBLIC') return null
  return { profile, username: authUser.displayUsername ?? authUser.username ?? username }
}

function resolveRole(role: unknown): AuthIdentityDto['role'] {
  if (role === null || role === undefined) return 'user'
  if (role === 'user' || role === 'superadmin') return role

  throw new Error('Authenticated user has an unsupported role.')
}

export async function getAuthenticatedProfile(ctx: QueryCtx | MutationCtx) {
  const authUser = await readAuthenticatedAuthUser(ctx)
  if (!authUser) return null
  if (isAuthUserBanned(authUser)) return null
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_authUserId', (query) => query.eq('authUserId', authUser._id))
    .unique()

  if (!profile) {
    throw new Error('Authenticated user profile is missing.')
  }

  return {
    identity: authIdentityDtoSchema.parse({
      userId: profile.userId,
      role: resolveRole(authUser.role)
    }),
    profile,
    email: authUser.email,
    emailVerified: authUser.emailVerified,
    canonicalUsername: authUser.username ?? null,
    username: authUser.displayUsername ?? authUser.username ?? null
  }
}

export async function requireIdentity(ctx: QueryCtx | MutationCtx): Promise<AuthIdentityDto> {
  const authenticated = await getAuthenticatedProfile(ctx)
  if (!authenticated) throw new Error('Unauthenticated')
  return authenticated.identity
}

export async function requireSuperadmin(ctx: QueryCtx | MutationCtx): Promise<AuthIdentityDto> {
  const authenticated = await getAuthenticatedProfile(ctx)
  if (!authenticated) throw new Error('Unauthenticated')
  if (authenticated.identity.role !== 'superadmin' || !authenticated.emailVerified) {
    throw new Error('Forbidden')
  }
  return authenticated.identity
}
