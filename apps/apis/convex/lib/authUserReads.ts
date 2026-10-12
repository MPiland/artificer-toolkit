import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  FunctionReturnType,
  PaginationResult
} from 'convex/server'
import { components } from '../_generated/api'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type authSchema from '../betterAuth/schema'

type AuthDataModel = DataModelFromSchemaDefinition<typeof authSchema>
type AuthUser = DocumentByName<AuthDataModel, 'user'>
type Context = QueryCtx | MutationCtx

export async function readAuthUser(ctx: Context, authUserId: string): Promise<AuthUser | null> {
  return ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: 'user',
    where: [{ field: '_id', value: authUserId }]
  })
}

/** Looks up an account by its canonical (lowercase) username through the indexed field. */
export async function readAuthUserByUsername(
  ctx: Context,
  username: string
): Promise<AuthUser | null> {
  return ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: 'user',
    where: [{ field: 'username', value: username.trim().toLowerCase() }]
  })
}

export function isAuthUserBanned(authUser: Pick<AuthUser, 'banned' | 'banExpires'>): boolean {
  return Boolean(authUser.banned) && (!authUser.banExpires || authUser.banExpires >= Date.now())
}

export async function readAuthUsers(ctx: Context, authUserIds: string[]): Promise<AuthUser[]> {
  if (!authUserIds.length) return []
  const users: PaginationResult<AuthUser> = await ctx.runQuery(
    components.betterAuth.adapter.findMany,
    {
      model: 'user',
      where: [{ field: '_id', operator: 'in', value: authUserIds }],
      paginationOpts: { cursor: null, numItems: authUserIds.length }
    }
  )
  if (!users.isDone) throw new Error('Auth user batch exceeded its complete bound.')
  return users.page
}

export async function readAuthenticatedAuthUser(
  ctx: Context
): Promise<FunctionReturnType<typeof components.betterAuth.sessionUser.get>> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity || typeof identity.sessionId !== 'string') return null
  return ctx.runQuery(components.betterAuth.sessionUser.get, {
    sessionId: identity.sessionId,
    userId: identity.subject
  })
}
