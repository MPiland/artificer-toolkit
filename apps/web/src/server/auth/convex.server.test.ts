import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'

const mocks = vi.hoisted(() => ({
  handler: vi.fn(),
  sign: vi.fn(),
  tokenFetch: vi.fn(),
  sessionFetch: vi.fn(),
  clients: [] as Array<{ token?: string }>,
  setAuth: vi.fn(),
  query: vi.fn()
}))
vi.mock('@convex-dev/better-auth/react-start', () => ({
  convexBetterAuthReactStart: () => ({ handler: mocks.handler })
}))
vi.mock('@artificer-toolkit/apis/auth-proxy-context', () => ({
  AUTH_PROXY_CONTEXT_HEADER: 'x-artificer-auth-proxy-context',
  signAuthProxyContext: mocks.sign
}))
vi.mock('convex/browser', () => ({
  ConvexHttpClient: class {
    token?: string
    constructor() {
      mocks.clients.push(this)
    }
    setAuth(token: string) {
      this.token = token
      mocks.setAuth(token)
    }
    query = mocks.query
  }
}))

import {
  createAuthenticatedConvexClient,
  handleConvexAuthRequest,
  loadConvexSession
} from './convex.server'

const EDGE_CLIENT_IP = '198.51.100.10'

/** A request as Cloudflare delivers it: the edge sets CF-Connecting-IP to the connecting client. */
function edgeRequest(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('cf-connecting-ip', EDGE_CLIENT_IP)
  return new Request(url, { ...init, headers })
}

describe('Convex auth SSR boundary', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    mocks.clients.length = 0
    vi.stubEnv('VITE_CONVEX_URL', 'https://example.convex.cloud')
    vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site')
    mocks.sign.mockResolvedValue('server-signed-context')
    // fetch responses have immutable headers, unlike a Response constructed by a test.
    const upstream = await fetch('data:application/json,%7B%7D')
    expect(() => upstream.headers.set('x-test', 'blocked')).toThrow()
    mocks.handler.mockResolvedValue(upstream)
    const nativeFetch = globalThis.fetch
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (input === 'https://example.convex.site/api/auth/convex/token') {
        return mocks.tokenFetch(input, init)
      }
      if (input === 'https://example.convex.site/api/auth/get-session') {
        return mocks.sessionFetch(input, init)
      }
      return nativeFetch(input, init)
    })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('overwrites spoofed context and signs only the edge client IP', async () => {
    const result = await handleConvexAuthRequest(
      edgeRequest('https://app.example/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
          'x-artificer-auth-proxy-context': 'forged',
          'x-artificer-client-ip': '192.0.2.1',
          'x-forwarded-for': '192.0.2.2',
          'x-real-ip': '192.0.2.3'
        }
      })
    )
    expect(mocks.sign).toHaveBeenCalledWith(
      {
        ip: EDGE_CLIENT_IP,
        method: 'POST',
        path: '/api/auth/sign-in/email'
      },
      'https://example.convex.site'
    )
    const forwarded: Request = mocks.handler.mock.calls[0][0]
    expect(forwarded.headers.get('x-artificer-auth-proxy-context')).toBe('server-signed-context')
    for (const name of [
      'cf-connecting-ip',
      'x-artificer-client-ip',
      'x-forwarded-for',
      'x-real-ip'
    ]) {
      expect(forwarded.headers.has(name)).toBe(false)
    }
    expect(result.headers.get('Cache-Control')).toBe('no-store')
  })

  it.each(['production', 'development'])(
    'fails closed without CF-Connecting-IP in a %s build, even on loopback',
    async (mode) => {
      vi.stubEnv('MODE', mode)
      for (const url of [
        'https://app.example/api/auth/get-session',
        'http://localhost:3000/api/auth/get-session'
      ]) {
        await expect(handleConvexAuthRequest(new Request(url))).rejects.toThrow(
          'Trusted authentication request context'
        )
        await expect(
          loadConvexSession(new Request(url, { headers: { cookie: 'session=test' } }))
        ).rejects.toThrow('Trusted authentication request context')
      }
      expect(mocks.sign).not.toHaveBeenCalled()
      expect(mocks.handler).not.toHaveBeenCalled()
      expect(mocks.tokenFetch).not.toHaveBeenCalled()
    }
  )

  it('rejects unsupported methods before reading the client IP', async () => {
    const result = await handleConvexAuthRequest(
      new Request('https://app.example/api/auth/get-session', { method: 'DELETE' })
    )
    expect(result.status).toBe(405)
    expect(mocks.handler).not.toHaveBeenCalled()
  })

  it.each(['GET', 'POST'])('streams a native %s request through the proxy', async (method) => {
    const payload = JSON.stringify({ email: 'player@example.com', password: 'test-password' })
    await handleConvexAuthRequest(
      edgeRequest('https://app.example/api/auth/sign-in/email?test=1', {
        method,
        headers: { cookie: 'session=test', 'content-type': 'application/json' },
        body: method === 'POST' ? payload : undefined
      })
    )
    const forwarded: Request = mocks.handler.mock.calls[0][0]
    expect(forwarded.url).toBe('https://app.example/api/auth/sign-in/email?test=1')
    expect(forwarded.method).toBe(method)
    expect(forwarded.headers.get('cookie')).toBe('session=test')
    expect(forwarded.headers.get('x-artificer-auth-proxy-context')).toBe('server-signed-context')
    expect(await forwarded.text()).toBe(method === 'POST' ? payload : '')
  })

  it('preserves redirects and separate cookies from a real local HTTP response', async () => {
    const cookies = [
      'session=local-test; HttpOnly; Path=/',
      'session_data=local-test; HttpOnly; Path=/'
    ]
    const server = createServer((_request, response) => {
      response.writeHead(302, { Location: '/sign-in', 'Set-Cookie': cookies }).end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Local HTTP fixture failed.')
      const upstream = await fetch(`http://127.0.0.1:${address.port}`, { redirect: 'manual' })
      mocks.handler.mockResolvedValue(upstream)
      const result = await handleConvexAuthRequest(
        edgeRequest('https://app.example/api/auth/verify-email')
      )
      expect(result.status).toBe(302)
      expect(result.headers.get('Location')).toBe('/sign-in')
      expect(result.headers.getSetCookie()).toEqual(cookies)
      expect(result.headers.get('Cache-Control')).toBe('no-store')
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  it('keeps the backend JWT out of the session projection', async () => {
    mocks.tokenFetch.mockResolvedValue(Response.json({ token: 'private-backend-jwt' }))
    const snapshot = {
      user: null,
      isSuperAdmin: false,
      featureFlags: { libraryImportEnabled: false, publicSignUpEnabled: false }
    }
    mocks.query.mockResolvedValue(snapshot)
    const result = await loadConvexSession(
      edgeRequest('https://app.example/home', { headers: { cookie: 'session=test' } })
    )
    expect(mocks.sign).toHaveBeenCalledWith(
      {
        ip: EDGE_CLIENT_IP,
        method: 'GET',
        path: '/api/auth/convex/token'
      },
      'https://example.convex.site'
    )
    expect(mocks.setAuth).toHaveBeenCalledWith('private-backend-jwt')
    expect(result).toEqual(snapshot)
    expect(JSON.stringify(result)).not.toContain('private-backend-jwt')
  })

  it('skips token exchange only for credential-free requests and still reads current backend flags', async () => {
    const snapshot = {
      user: null,
      isSuperAdmin: false,
      featureFlags: { libraryImportEnabled: true, publicSignUpEnabled: false }
    }
    mocks.query.mockResolvedValue(snapshot)
    const request = edgeRequest('https://app.example/sign-in', {
      headers: { 'x-user-id': 'spoofed', 'x-artificer-auth-proxy-context': 'forged' }
    })
    expect(await loadConvexSession(request)).toEqual(snapshot)
    expect(mocks.sign).toHaveBeenCalledOnce()
    expect(mocks.tokenFetch).not.toHaveBeenCalled()
    expect(mocks.setAuth).not.toHaveBeenCalled()
    expect(mocks.query).toHaveBeenCalledOnce()
  })

  it.each(['cookie', 'authorization'])(
    'retains token verification for credential-bearing requests: %s',
    async (header) => {
      const snapshot = {
        user: null,
        isSuperAdmin: false,
        featureFlags: { libraryImportEnabled: false, publicSignUpEnabled: false }
      }
      mocks.tokenFetch.mockResolvedValue(Response.json({ token: 'verified-backend-jwt' }))
      mocks.query.mockResolvedValue(snapshot)
      const request = edgeRequest('https://app.example/home', {
        headers: { [header]: header === 'cookie' ? 'session=test' : 'Bearer supplied-token' }
      })
      expect(await loadConvexSession(request)).toEqual(snapshot)
      expect(mocks.tokenFetch).toHaveBeenCalledOnce()
      expect(mocks.setAuth).toHaveBeenCalledWith('verified-backend-jwt')

      mocks.query.mockClear()
      mocks.tokenFetch.mockRejectedValue(new Error('Verification failed'))
      await expect(loadConvexSession(request)).rejects.toThrow('Verification failed')
      expect(mocks.query).not.toHaveBeenCalled()
    }
  )

  it('keeps parallel authenticated and anonymous clients isolated', async () => {
    mocks.tokenFetch.mockImplementation(async (_url: string, init: RequestInit) =>
      Response.json({
        token:
          new Headers(init.headers).get('cookie') === 'session=first' ? 'first-jwt' : 'second-jwt'
      })
    )
    const clients = await Promise.all([
      createAuthenticatedConvexClient(
        edgeRequest('https://app.example/backgrounds', { headers: { cookie: 'session=first' } })
      ),
      createAuthenticatedConvexClient(
        edgeRequest('https://app.example/backgrounds', { headers: { cookie: 'session=second' } })
      ),
      createAuthenticatedConvexClient(edgeRequest('https://app.example/backgrounds'))
    ])
    expect(new Set(clients).size).toBe(3)
    expect(mocks.clients.map((client) => client.token).sort()).toEqual([
      'first-jwt',
      'second-jwt',
      undefined
    ])
    expect(mocks.tokenFetch).toHaveBeenCalledTimes(2)
  })

  it('requires a successful null session before treating token denial as signed out', async () => {
    mocks.tokenFetch.mockResolvedValue(new Response(null, { status: 401 }))
    mocks.sessionFetch.mockResolvedValue(Response.json(null))
    await createAuthenticatedConvexClient(
      edgeRequest('https://app.example/home', { headers: { cookie: 'session=expired' } })
    )
    expect(mocks.setAuth).not.toHaveBeenCalled()
    // workerd rejects redirect: 'error'; a redirect must surface as a non-2xx response instead.
    expect(mocks.tokenFetch.mock.calls[0][1].redirect).toBe('manual')
    expect(mocks.sessionFetch.mock.calls[0][1].redirect).toBe('manual')
    expect(mocks.sessionFetch.mock.calls[0][1].headers.get('host')).toBe('example.convex.site')
    expect(mocks.sign).toHaveBeenLastCalledWith(
      { ip: EDGE_CLIENT_IP, path: '/api/auth/get-session', method: 'GET' },
      'https://example.convex.site'
    )
  })

  it.each([302, 500, 200])(
    'rejects token denial without confirmed signed-out state (%i)',
    async (status) => {
      mocks.tokenFetch.mockResolvedValue(new Response(null, { status: 401 }))
      mocks.sessionFetch.mockResolvedValue(
        Response.json({ session: { id: 'still-active' } }, { status })
      )
      await expect(
        loadConvexSession(
          edgeRequest('https://app.example/home', { headers: { cookie: 'session=test' } })
        )
      ).rejects.toThrow('Authentication verification is unavailable')
      expect(mocks.query).not.toHaveBeenCalled()
    }
  )

  it('retries one rate-limited token mint and recovers', async () => {
    mocks.tokenFetch
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'x-retry-after': '0' } }))
      .mockResolvedValueOnce(Response.json({ token: 'jwt' }))
    mocks.query.mockResolvedValue(null)
    await createAuthenticatedConvexClient(
      edgeRequest('https://app.example/classes', { headers: { cookie: 'session=test' } })
    )
    expect(mocks.tokenFetch).toHaveBeenCalledTimes(2)
    expect(mocks.setAuth).toHaveBeenCalledWith('jwt')
  })

  it('reports persistent rate limiting as rate limiting, not an auth outage', async () => {
    mocks.tokenFetch.mockResolvedValue(
      new Response(null, { status: 429, headers: { 'x-retry-after': '0' } })
    )
    await expect(
      loadConvexSession(
        edgeRequest('https://app.example/classes', { headers: { cookie: 'session=test' } })
      )
    ).rejects.toThrow('Authentication is rate limited.')
    expect(mocks.tokenFetch).toHaveBeenCalledTimes(2)
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it.each([302, 403, 500])('does not turn HTTP %i into an anonymous session', async (status) => {
    mocks.tokenFetch.mockResolvedValue(new Response(null, { status }))
    await expect(
      loadConvexSession(
        edgeRequest('https://app.example/home', { headers: { cookie: 'session=test' } })
      )
    ).rejects.toThrow('Authentication verification is unavailable')
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it.each([{}, { token: null }, { token: '' }])(
    'rejects malformed success payloads: %j',
    async (payload) => {
      mocks.tokenFetch.mockResolvedValue(Response.json(payload))
      await expect(
        loadConvexSession(
          edgeRequest('https://app.example/home', { headers: { cookie: 'session=test' } })
        )
      ).rejects.toThrow('invalid response')
      expect(mocks.query).not.toHaveBeenCalled()
    }
  )
})
