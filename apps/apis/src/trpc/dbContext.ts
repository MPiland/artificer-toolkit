import { TRPCError } from '@trpc/server'
import { ZodError } from 'zod'
import { createDb, withUserContext, type DBLike, type KyselyDatabase } from '@artificer-toolkit/db'

export interface TrpcContext {
  databaseConnectionString?: string
  isSuperAdmin?: boolean
  userId: string | null
}

export interface AuthenticatedTrpcContext {
  isSuperAdmin: boolean
  userId: string
}

const defaultConnectionKey = '__default__'
const globalDbCache = globalThis as typeof globalThis & {
  __artificerApiDbs?: Map<string, KyselyDatabase>
}
const sharedDbs = globalDbCache.__artificerApiDbs ?? new Map<string, KyselyDatabase>()
globalDbCache.__artificerApiDbs = sharedDbs

function getSharedDb(connectionString: string | undefined): KyselyDatabase {
  const key = connectionString ?? defaultConnectionKey
  const existing = sharedDbs.get(key)
  if (existing) return existing

  const db = createDb({ connectionString })
  sharedDbs.set(key, db)
  return db
}

export function requireUserId(ctx: TrpcContext): string {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication is required.'
    })
  }

  return ctx.userId
}

function mapErrorToCode(error: Error): TRPCError['code'] {
  if (error instanceof ZodError) return 'UNPROCESSABLE_CONTENT'
  if (error.name === 'NodeRuntimeInputError') return 'BAD_REQUEST'
  if (error.name === 'AuthoredDraftSubjectMismatchError') return 'UNPROCESSABLE_CONTENT'
  if (error.name === 'AuthoredDraftNotFoundError') return 'NOT_FOUND'
  if (error.name === 'NotFoundError') return 'NOT_FOUND'
  if (error.name === 'AuthoredContentOwnershipError') return 'FORBIDDEN'
  if (error.name === 'AuthoredContentDependencyError') return 'CONFLICT'
  if (error.name === 'AuthoredDefinitionRevisionConflictError') return 'CONFLICT'
  if (error.name === 'CharacterBuilderDraftConflictError') return 'CONFLICT'
  if (error.name === 'ConcurrencyError') return 'CONFLICT'
  if (error.name === 'CharacterSheetCommandError') return 'BAD_REQUEST'

  return 'INTERNAL_SERVER_ERROR'
}

function getErrorMessage(error: Error): string {
  if (error instanceof ZodError) {
    return 'Validation failed'
  }

  return error.message || 'Internal Server Error'
}

export function toTrpcError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error
  }

  if (error instanceof Error) {
    return new TRPCError({
      cause: error,
      code: mapErrorToCode(error),
      message: getErrorMessage(error)
    })
  }

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal Server Error'
  })
}

export async function withAuthenticatedDb<TResult>(
  ctx: TrpcContext,
  callback: (db: DBLike, userId: string, auth: AuthenticatedTrpcContext) => Promise<TResult>
): Promise<TResult> {
  const userId = requireUserId(ctx)
  const db = getSharedDb(ctx.databaseConnectionString)
  const auth = {
    isSuperAdmin: ctx.isSuperAdmin === true,
    userId
  }

  try {
    return await withUserContext(db, userId, (scopedDb) => callback(scopedDb, userId, auth))
  } catch (error) {
    throw toTrpcError(error)
  }
}
