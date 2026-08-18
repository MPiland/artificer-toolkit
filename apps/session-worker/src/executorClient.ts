import {
  liveSessionExecutorErrorDtoSchema,
  liveSessionExecutorResponseDtoSchema,
  type LiveSessionExecutorRequestDto,
  type LiveSessionExecutorResponseDto
} from '@artificer-toolkit/schema/api/liveSessions'

import type { SessionWorkerEnvironment } from './environment.js'

const EXECUTOR_TIMEOUT_MS = 10_000
const AUTHORITATIVE_EXECUTOR_TIMEOUT_MS = 55_000

export class LiveSessionExecutorRequestError extends Error {
  constructor(
    readonly code: 'INVALID_REQUEST' | 'UNAUTHORIZED' | 'CONFLICT' | 'COMMAND_FAILED',
    message: string,
    readonly retryable: boolean
  ) {
    super(message)
    this.name = 'LiveSessionExecutorRequestError'
  }
}

export async function callLiveSessionExecutor(
  environment: Pick<
    SessionWorkerEnvironment,
    'LIVE_SESSION_EXECUTOR_SECRET' | 'LIVE_SESSION_EXECUTOR_URL'
  >,
  request: LiveSessionExecutorRequestDto
): Promise<LiveSessionExecutorResponseDto> {
  const timeoutMs =
    request.operation === 'SNAPSHOT' || request.operation === 'COMMAND'
      ? AUTHORITATIVE_EXECUTOR_TIMEOUT_MS
      : EXECUTOR_TIMEOUT_MS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(environment.LIVE_SESSION_EXECUTOR_URL, {
      body: JSON.stringify(request),
      headers: {
        authorization: `Bearer ${environment.LIVE_SESSION_EXECUTOR_SECRET}`,
        'content-type': 'application/json'
      },
      method: 'POST',
      signal: controller.signal
    })
  } catch (error) {
    throw new LiveSessionExecutorRequestError(
      'COMMAND_FAILED',
      error instanceof Error ? error.message : 'Live-session executor request failed.',
      true
    )
  } finally {
    clearTimeout(timeout)
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const parsed = liveSessionExecutorErrorDtoSchema.safeParse(body)
    throw new LiveSessionExecutorRequestError(
      parsed.success ? parsed.data.error.code : 'COMMAND_FAILED',
      parsed.success ? parsed.data.error.message : 'Live-session executor request failed.',
      response.status >= 500
    )
  }
  return liveSessionExecutorResponseDtoSchema.parse(body)
}
