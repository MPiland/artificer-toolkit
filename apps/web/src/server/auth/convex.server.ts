import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  AUTH_PROXY_CONTEXT_HEADER,
  signAuthProxyContext
} from '@artificer-toolkit/apis/auth-proxy-context'
import { authSessionSnapshotDtoSchema } from '@artificer-toolkit/schema/api/auth'

const MAX_RATE_LIMIT_RETRY_MS = 2000

function connection() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL
  const convexSiteUrl = process.env.CONVEX_SITE_URL
  if (!convexUrl || !convexSiteUrl) throw new Error('Convex auth must be configured.')
  return { convexUrl, convexSiteUrl }
}

async function proxyHeaders(request: Request, path: string, method: 'GET' | 'POST') {
  // The Cloudflare edge sets CF-Connecting-IP to the connecting client, and workerd sets it in local
  // dev. Without it the request did not arrive through the platform, so auth fails closed.
  const ip = request.headers.get('cf-connecting-ip')
  if (!ip) throw new Error('Trusted authentication request context is unavailable.')
  const headers = new Headers(request.headers)
  for (const name of [
    'cf-connecting-ip',
    'x-forwarded-for',
    'x-real-ip',
    'x-artificer-client-ip',
    'content-length',
    'transfer-encoding'
  ]) {
    headers.delete(name)
  }
  headers.set(
    AUTH_PROXY_CONTEXT_HEADER,
    await signAuthProxyContext({ ip, path, method }, connection().convexSiteUrl)
  )
  return headers
}

export async function handleConvexAuthRequest(request: Request) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } })
  }
  const headers = await proxyHeaders(request, new URL(request.url).pathname, request.method)
  const init: RequestInit & { duplex: 'half' } = {
    method: request.method,
    headers,
    body: request.body,
    signal: request.signal,
    duplex: 'half'
  }
  const response = await convexBetterAuthReactStart(connection()).handler(
    new Request(request.url, init)
  )
  const responseHeaders = new Headers(response.headers)
  responseHeaders.set('Cache-Control', 'no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  })
}

/** The caller's Convex JWT, or null for a credential-free or confirmed signed-out request. */
async function mintToken(request: Request): Promise<string | null> {
  const { convexSiteUrl } = connection()
  const headers = await proxyHeaders(request, '/api/auth/convex/token', 'GET')
  if (request.headers.has('cookie') || request.headers.has('authorization')) {
    headers.set('host', new URL(convexSiteUrl).host)
    // The SDK's token helper discards HTTP failures. Preserve them so outages
    // cannot masquerade as anonymous SSR reads. workerd has no `redirect: 'error'`, so redirects
    // are not followed and fail the `ok` checks below instead.
    const fetchToken = () =>
      fetch(`${convexSiteUrl}/api/auth/convex/token`, { headers, redirect: 'manual' })
    let response = await fetchToken()
    if (response.status === 429) {
      // Rate limiting is not an auth outage. Honor Better Auth's retry hint once, then say so.
      const retryAfterSeconds = Number(response.headers.get('x-retry-after'))
      const delayMs = Math.min(Math.max(retryAfterSeconds, 0) * 1000, MAX_RATE_LIMIT_RETRY_MS)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      response = await fetchToken()
      if (response.status === 429) throw new Error('Authentication is rate limited.')
    }
    if (response.status === 401) {
      // Better Auth's token middleware also maps session-adapter failures to 401.
      // Its get-session endpoint preserves those errors; only a successful null
      // session proves signed-out state. This extra read runs only on token denial.
      const sessionHeaders = await proxyHeaders(request, '/api/auth/get-session', 'GET')
      sessionHeaders.set('host', new URL(convexSiteUrl).host)
      const session = await fetch(`${convexSiteUrl}/api/auth/get-session`, {
        headers: sessionHeaders,
        redirect: 'manual'
      })
      if (!session.ok || (await session.json()) !== null) {
        throw new Error('Authentication verification is unavailable.')
      }
      return null
    }
    if (!response.ok) throw new Error('Authentication verification is unavailable.')
    const payload: unknown = await response.json()
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('token' in payload) ||
      typeof payload.token !== 'string' ||
      !payload.token
    ) {
      throw new Error('Authentication verification returned an invalid response.')
    }
    return payload.token
  }
  return null
}

const requestTokens = new WeakMap<Request, Promise<string | null>>()

/**
 * `mintToken` once per incoming request. The session read and the SSR loaders share it, so a
 * page view costs one `/convex/token` request on the server. The token is never serialized into
 * the page, so the browser mints its own. A rejection stays cached: a failed exchange is never retried anonymously.
 */
export function requestToken(request: Request) {
  let token = requestTokens.get(request)
  if (!token) {
    token = mintToken(request)
    requestTokens.set(request, token)
  }
  return token
}

export async function createAuthenticatedConvexClient(
  request: Request,
  getToken: (request: Request) => Promise<string | null> = requestToken
) {
  const client = new ConvexHttpClient(connection().convexUrl)
  const token = await getToken(request)
  if (token) client.setAuth(token)
  return client
}

/** Reads the session snapshot; `getToken` defaults to a fresh mint, `requestToken` shares the request's. */
export async function loadConvexSession(
  request: Request,
  getToken: (request: Request) => Promise<string | null> = mintToken
) {
  const client = await createAuthenticatedConvexClient(request, getToken)
  return authSessionSnapshotDtoSchema.parse(await client.query(api.account.session, {}))
}
