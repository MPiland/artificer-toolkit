import { timingSafeEqual } from 'node:crypto'

import { createDb, withUserContext, type KyselyDatabase } from '@artificer-toolkit/db'
import { executeLiveSessionExecutorRequest } from '@artificer-toolkit/functions/services'
import {
  liveSessionExecutorErrorDtoSchema,
  liveSessionExecutorRequestDtoSchema,
  type LiveSessionExecutorErrorDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { ZodError } from 'zod'

const MAX_EXECUTOR_REQUEST_BYTES = 512 * 1024
let database: KyselyDatabase | undefined

function getDatabase(): KyselyDatabase {
  database ??= createDb()
  return database
}

function requiredSecret(): string {
  const secret = process.env.LIVE_SESSION_EXECUTOR_SECRET
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('LIVE_SESSION_EXECUTOR_SECRET must contain at least 32 bytes.')
  }
  return secret
}

function authorized(request: Request, expected: string): boolean {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return false
  const actual = Buffer.from(header.slice('Bearer '.length), 'utf8')
  const expectedBytes = Buffer.from(expected, 'utf8')
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes)
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    headers: { 'cache-control': 'no-store' },
    status
  })
}

function errorResponse(
  status: number,
  code: LiveSessionExecutorErrorDto['error']['code'],
  message: string
): Response {
  return jsonResponse(
    liveSessionExecutorErrorDtoSchema.parse({
      error: { code, message: message.slice(0, 300) }
    }),
    status
  )
}

async function boundedJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'INVALID_REQUEST', 'Content-Type must be application/json.')
  }
  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null && Number(declaredLength) > MAX_EXECUTOR_REQUEST_BYTES) {
    return errorResponse(413, 'INVALID_REQUEST', 'Live-session executor request is too large.')
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > MAX_EXECUTOR_REQUEST_BYTES) {
    return errorResponse(413, 'INVALID_REQUEST', 'Live-session executor request is too large.')
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return errorResponse(400, 'INVALID_REQUEST', 'Live-session executor request is invalid JSON.')
  }
}

function domainError(error: unknown): Response {
  if (error instanceof ZodError) {
    return errorResponse(400, 'INVALID_REQUEST', 'Live-session executor request is invalid.')
  }
  const name = error instanceof Error ? error.name : ''
  if (
    name === 'CharacterSheetCommandError' ||
    name === 'EncounterNotFoundError' ||
    name === 'EncounterValidationError'
  ) {
    return errorResponse(400, 'INVALID_REQUEST', 'Live-session command is invalid.')
  }
  if (name === 'CampaignAccessError' || name === 'LiveSessionAuthorityError') {
    return errorResponse(403, 'UNAUTHORIZED', 'Live-session command is not authorized.')
  }
  if (
    name === 'ConcurrencyError' ||
    name === 'EncounterConflictError' ||
    name === 'LiveSessionCommandAuthorityError'
  ) {
    return errorResponse(
      409,
      'CONFLICT',
      'Live-session state changed before the command committed.'
    )
  }
  return errorResponse(500, 'COMMAND_FAILED', 'Live-session command failed.')
}

export default async function liveSessionExecutor(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(null, { headers: { allow: 'POST' }, status: 405 })
  }

  let secret: string
  try {
    secret = requiredSecret()
  } catch {
    return errorResponse(503, 'COMMAND_FAILED', 'Live-session executor is unavailable.')
  }
  if (!authorized(request, secret)) {
    return errorResponse(401, 'UNAUTHORIZED', 'Live-session executor authentication failed.')
  }

  const rawRequest = await boundedJson(request)
  if (rawRequest instanceof Response) return rawRequest

  try {
    const input = liveSessionExecutorRequestDtoSchema.parse(rawRequest)
    const commandStartedAt = input.operation === 'COMMAND' ? performance.now() : null
    const result = await withUserContext(getDatabase(), input.userId, (db) =>
      executeLiveSessionExecutorRequest(db, input)
    )
    return jsonResponse(
      commandStartedAt !== null && result.operation === 'COMMAND'
        ? {
            ...result,
            execution: {
              ...result.execution,
              hostTiming: {
                ...result.execution.hostTiming,
                durationMs: performance.now() - commandStartedAt
              }
            }
          }
        : result
    )
  } catch (error) {
    return domainError(error)
  }
}
