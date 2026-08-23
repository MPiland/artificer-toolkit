import { TRPCError } from '@trpc/server'
import { ZodError } from 'zod'
import { createDb, withUserContext, type DBLike, type KyselyDatabase } from '@artificer-toolkit/db'

export interface TrpcContext {
  clientIp?: string
  databaseConnectionString?: string
  invitationSetupPending: boolean
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
  if (error.name === 'AuthoredContentCreationRateLimitError') return 'TOO_MANY_REQUESTS'
  if (error.name === 'AuthoredContentConflictError') return 'CONFLICT'
  if (error.name === 'CharacterBuilderDraftConflictError') return 'CONFLICT'
  if (error.name === 'ConcurrencyError') return 'CONFLICT'
  if (error.name === 'UsernameConflictError') return 'CONFLICT'
  if (error.name === 'CharacterSheetCommandError') return 'BAD_REQUEST'
  if (error.name === 'MediaNotFoundError') return 'NOT_FOUND'
  if (error.name === 'MediaAccessError') return 'FORBIDDEN'
  if (error.name === 'MediaConflictError') return 'CONFLICT'
  if (error.name === 'MediaValidationError') return 'UNPROCESSABLE_CONTENT'
  if (error.name === 'MediaQuotaError') return 'PAYLOAD_TOO_LARGE'
  if (error.name === 'CampaignAccessError' || error.name === 'EntitlementLimitError') {
    return 'FORBIDDEN'
  }
  if (error.name === 'CampaignNotFoundError') return 'NOT_FOUND'
  if (
    error.name === 'CampaignConflictError' ||
    error.name === 'CampaignContentShareRemovalConflictError'
  ) {
    return 'CONFLICT'
  }
  if (error.name === 'LiveSessionCommandAuthorityError') return 'CONFLICT'
  if (error.name === 'CampaignValidationError' || error.name === 'RangeError') {
    return 'BAD_REQUEST'
  }
  if (error.name === 'SocialAccessError' || error.name === 'SocialEligibilityError') {
    return 'FORBIDDEN'
  }
  if (error.name === 'SocialNotFoundError') return 'NOT_FOUND'
  if (error.name === 'SocialConflictError') return 'CONFLICT'
  if (error.name === 'SocialValidationError') return 'BAD_REQUEST'
  if (error.name === 'SocialRateLimitError') return 'TOO_MANY_REQUESTS'
  if (error.name === 'EncounterNotFoundError') return 'NOT_FOUND'
  if (error.name === 'EncounterConflictError') return 'CONFLICT'
  if (error.name === 'EncounterValidationError') return 'BAD_REQUEST'
  if (error.name === 'RuleAccessError') return 'FORBIDDEN'
  if (error.name === 'RuleNotFoundError') return 'NOT_FOUND'
  if (error.name === 'RuleConflictError') return 'CONFLICT'
  if (error.name === 'RuleDocumentValidationError' || error.name === 'RuleConformanceError') {
    return 'BAD_REQUEST'
  }
  if (
    error.name === 'InsufficientInventoryCurrencyError' ||
    error.name === 'InventoryCurrencyAmountRangeError'
  ) {
    return 'BAD_REQUEST'
  }

  return 'INTERNAL_SERVER_ERROR'
}

function getErrorMessage(error: Error, code: TRPCError['code']): string {
  if (code === 'INTERNAL_SERVER_ERROR') {
    return 'Internal Server Error'
  }

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
    const code = mapErrorToCode(error)
    return new TRPCError({
      cause: error,
      code,
      message: getErrorMessage(error, code)
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

export async function withExplicitAuthorityDb<TResult>(
  ctx: TrpcContext,
  callback: (db: DBLike, userId: string) => Promise<TResult>
): Promise<TResult> {
  const userId = requireUserId(ctx)

  try {
    return await callback(getSharedDb(ctx.databaseConnectionString), userId)
  } catch (error) {
    throw toTrpcError(error)
  }
}

export async function withDb<TResult>(
  ctx: TrpcContext,
  callback: (db: DBLike) => Promise<TResult>
): Promise<TResult> {
  try {
    return await callback(getSharedDb(ctx.databaseConnectionString))
  } catch (error) {
    throw toTrpcError(error)
  }
}
