import {
  liveSessionExecutorErrorDtoSchema,
  liveSessionExecutorResponseDtoSchema,
  type LiveSessionExecutorRequestDto,
  type LiveSessionExecutorResponseDto
} from '@artificer-toolkit/schema/api/liveSessions'

import type { SessionWorkerEnvironment } from './environment.js'

const EXECUTOR_TIMEOUT_MS = 10_000

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
  environment: SessionWorkerEnvironment,
  request: LiveSessionExecutorRequestDto
): Promise<LiveSessionExecutorResponseDto> {
  let response: Response
  try {
    response = await fetch(environment.LIVE_SESSION_EXECUTOR_URL, {
      body: JSON.stringify(request),
      headers: {
        authorization: `Bearer ${environment.LIVE_SESSION_EXECUTOR_SECRET}`,
        'content-type': 'application/json'
      },
      method: 'POST',
      signal: AbortSignal.timeout(EXECUTOR_TIMEOUT_MS)
    })
  } catch (error) {
    throw new LiveSessionExecutorRequestError(
      'COMMAND_FAILED',
      error instanceof Error ? error.message : 'Live-session executor request failed.',
      true
    )
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
