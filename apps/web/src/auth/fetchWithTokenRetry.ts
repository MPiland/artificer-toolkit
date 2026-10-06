const MAX_RETRIES = 4
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 15_000

function isTokenRequest(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  return (
    method.toUpperCase() === 'GET' &&
    new URL(url, 'http://localhost').pathname.endsWith('/convex/token')
  )
}

function retryDelayMs(response: Response | undefined, attempt: number) {
  const header = response?.headers.get('retry-after') ?? response?.headers.get('x-retry-after')
  const headerMs = header
    ? /^\d+$/.test(header)
      ? Number(header) * 1000
      : Date.parse(header) - Date.now()
    : Number.NaN
  return Math.min(
    MAX_DELAY_MS,
    Math.max(0, Number.isNaN(headerMs) ? BASE_DELAY_MS * 2 ** attempt : headerMs)
  )
}

/**
 * Fetch for the Better Auth client. The Convex provider reads any failed token fetch as "signed
 * out", so a transient failure (429, 5xx, network) of the idempotent token request is retried with
 * bounded backoff, honoring Retry-After, instead of surfacing as a guest. Only a definitive response
 * (200, 401, ...) or exhausted retries reach the caller. All other requests pass through untouched.
 */
export async function fetchWithTokenRetry(input: RequestInfo | URL, init?: RequestInit) {
  if (!isTokenRequest(input, init)) return fetch(input, init)

  for (let attempt = 0; ; attempt++) {
    let response: Response | undefined
    try {
      response = await fetch(input, init)
    } catch (error) {
      if (attempt === MAX_RETRIES || init?.signal?.aborted) throw error
    }
    const transient = !response || response.status === 429 || response.status >= 500
    if (response && (!transient || attempt === MAX_RETRIES)) return response
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response, attempt)))
  }
}
