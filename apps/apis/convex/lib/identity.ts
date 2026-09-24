import { authIdentityDtoSchema, type AuthIdentityDto } from '@artificer-toolkit/schema/api/auth'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { readAuthenticatedAuthUser } from './authUserReads'

function resolveRole(role: unknown): AuthIdentityDto['role'] {
  if (role === null || role === undefined) return 'user'
  if (role === 'user' || role === 'superadmin') return role

  throw new Error('Authenticated user has an unsupported role.')
}

export async function getAuthenticatedProfile(ctx: QueryCtx | MutationCtx) {
  const authUser = await readAuthenticatedAuthUser(ctx)
  if (!authUser) return null
  if (authUser.banned && (!authUser.banExpires || authUser.banExpires >= Date.now())) return null
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
