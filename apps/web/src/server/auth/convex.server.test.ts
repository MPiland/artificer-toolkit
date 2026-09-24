import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer, IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { NodeRequest } from 'srvx/node'

const mocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  handler: vi.fn(),
  sign: vi.fn(),
  tokenFetch: vi.fn(),
  sessionFetch: vi.fn(),
  clients: [] as Array<{ token?: string }>,
  setAuth: vi.fn(),
  query: vi.fn()
}))
vi.mock('@netlify/functions', () => ({ getContext: mocks.getContext }))
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

describe('Convex auth SSR boundary', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    mocks.clients.length = 0
    vi.stubEnv('VITE_CONVEX_URL', 'https://example.convex.cloud')
    vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site')
    mocks.getContext.mockReturnValue({ ip: '198.51.100.10' })
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

  it('overwrites spoofed context and signs only the platform client IP', async () => {
    const result = await handleConvexAuthRequest(
      new Request('https://app.example/api/auth/sign-in/email', {
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
        ip: '198.51.100.10',
        method: 'POST',
        path: '/api/auth/sign-in/email'
      },
      'https://example.convex.site'
    )
    const forwarded: Request = mocks.handler.mock.calls[0][0]
    expect(forwarded.headers.get('x-artificer-auth-proxy-context')).toBe('server-signed-context')
    for (const name of ['x-artificer-client-ip', 'x-forwarded-for', 'x-real-ip']) {
      expect(forwarded.headers.has(name)).toBe(false)
    }
    expect(result.headers.get('Cache-Control')).toBe('no-store')
  })

  it('fails closed without platform context in production and rejects unsupported methods', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mocks.getContext.mockImplementation(() => {
      throw new Error('No platform request')
    })
    await expect(
      handleConvexAuthRequest(new Request('https://app.example/api/auth/get-session'))
    ).rejects.toThrow('Trusted authentication request context')
    const result = await handleConvexAuthRequest(
      new Request('https://app.example/api/auth/get-session', { method: 'DELETE' })
    )
    expect(result.status).toBe(405)
    expect(mocks.handler).not.toHaveBeenCalled()
  })

  it.each(['GET', 'POST'])(
    'forwards a real TanStack NodeRequest for %s without native Request brand assumptions',
    async (method) => {
      const incoming = new IncomingMessage(new Socket())
      incoming.method = method
      incoming.url = '/api/auth/sign-in/email?test=1'
      incoming.headers = {
        host: 'app.example',
        cookie: 'session=test',
        'content-type': 'application/json'
      }
      incoming.rawHeaders = [
        'Host',
        'app.example',
        'Cookie',
        'session=test',
        'Content-Type',
        'application/json'
      ]
      incoming.complete = true
      const payload = JSON.stringify({ email: 'player@example.com', password: 'test-password' })
      if (method === 'POST') incoming.push(payload)
      incoming.push(null)
      const request = new NodeRequest({ req: incoming })
      await handleConvexAuthRequest(request)
      const forwarded: Request = mocks.handler.mock.calls[0][0]
      expect(forwarded.url).toBe('http://app.example/api/auth/sign-in/email?test=1')
      expect(forwarded.method).toBe(method)
      expect(forwarded.headers.get('cookie')).toBe('session=test')
      expect(forwarded.headers.get('x-artificer-auth-proxy-context')).toBe('server-signed-context')
      expect(await forwarded.text()).toBe(method === 'POST' ? payload : '')
    }
  )

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
        new Request('https://app.example/api/auth/verify-email')
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

  it('uses a loopback bucket only locally and keeps the backend JWT out of the session projection', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    mocks.getContext.mockImplementation(() => {
      throw new Error('Vite request')
    })
    mocks.tokenFetch.mockResolvedValue(Response.json({ token: 'private-backend-jwt' }))
    const snapshot = {
      user: null,
      isSuperAdmin: false,
      featureFlags: { libraryImportEnabled: false, publicSignUpEnabled: false }
    }
    mocks.query.mockResolvedValue(snapshot)
    const result = await loadConvexSession(
      new Request('http://localhost:3000/home', { headers: { cookie: 'session=test' } })
    )
    expect(mocks.sign).toHaveBeenCalledWith(
      {
        ip: '127.0.0.1',
        method: 'GET',
        path: '/api/auth/convex/token'
      },
      'https://example.convex.site'
    )
    expect(mocks.setAuth).toHaveBeenCalledWith('private-backend-jwt')
    expect(result).toEqual(snapshot)
    expect(JSON.stringify(result)).not.toContain('private-backend-jwt')
    await expect(loadConvexSession(new Request('http://public.example/home'))).rejects.toThrow()
  })

  it('skips token exchange only for credential-free requests and still reads current backend flags', async () => {
    const snapshot = {
      user: null,
      isSuperAdmin: false,
      featureFlags: { libraryImportEnabled: true, publicSignUpEnabled: false }
    }
    mocks.query.mockResolvedValue(snapshot)
    const request = new Request('https://app.example/sign-in', {
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
      const request = new Request('https://app.example/home', {
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
        new Request('https://app.example/backgrounds', { headers: { cookie: 'session=first' } })
      ),
      createAuthenticatedConvexClient(
        new Request('https://app.example/backgrounds', { headers: { cookie: 'session=second' } })
      ),
      createAuthenticatedConvexClient(new Request('https://app.example/backgrounds'))
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
      new Request('https://app.example/home', { headers: { cookie: 'session=expired' } })
    )
    expect(mocks.setAuth).not.toHaveBeenCalled()
    expect(mocks.tokenFetch.mock.calls[0][1].redirect).toBe('error')
    expect(mocks.sessionFetch.mock.calls[0][1].headers.get('host')).toBe('example.convex.site')
    expect(mocks.sign).toHaveBeenLastCalledWith(
      { ip: '198.51.100.10', path: '/api/auth/get-session', method: 'GET' },
      'https://example.convex.site'
    )
  })

  it.each([500, 200])(
    'rejects token denial without confirmed signed-out state (%i)',
    async (status) => {
      mocks.tokenFetch.mockResolvedValue(new Response(null, { status: 401 }))
      mocks.sessionFetch.mockResolvedValue(
        Response.json({ session: { id: 'still-active' } }, { status })
      )
      await expect(
        loadConvexSession(
          new Request('https://app.example/home', { headers: { cookie: 'session=test' } })
        )
      ).rejects.toThrow('Authentication verification is unavailable')
      expect(mocks.query).not.toHaveBeenCalled()
    }
  )

  it.each([403, 429, 500])('does not turn HTTP %i into an anonymous session', async (status) => {
    mocks.tokenFetch.mockResolvedValue(new Response(null, { status }))
    await expect(
      loadConvexSession(
        new Request('https://app.example/home', { headers: { cookie: 'session=test' } })
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
          new Request('https://app.example/home', { headers: { cookie: 'session=test' } })
        )
      ).rejects.toThrow('invalid response')
      expect(mocks.query).not.toHaveBeenCalled()
    }
  )
})
