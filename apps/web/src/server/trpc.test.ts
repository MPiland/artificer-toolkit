import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  crossSiteRequestResponse: vi.fn(() => new Response(null, { status: 403 })),
  handleTrpcFetchRequest: vi.fn(),
  isTrustedSameOriginRequest: vi.fn(() => true),
  parseCookieHeader: vi.fn(() => []),
  serializeCookieHeader: vi.fn(() => 'session=value')
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
  parseCookieHeader: mocks.parseCookieHeader,
  serializeCookieHeader: mocks.serializeCookieHeader
}))

vi.mock('@artificer-toolkit/apis/trpc-handler', () => ({
  handleTrpcFetchRequest: mocks.handleTrpcFetchRequest
}))

vi.mock('#app/lib/trpcRequestSecurity', () => ({
  crossSiteRequestResponse: mocks.crossSiteRequestResponse,
  isTrustedSameOriginRequest: mocks.isTrustedSameOriginRequest
}))

describe('handleTrpcRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleTrpcFetchRequest.mockResolvedValue(new Response('ok'))
  })

  it('rejects known oversized authored payloads before authentication', async () => {
    const { handleTrpcRequest } = await import('./trpc')
    const response = await handleTrpcRequest(
      new Request('https://app.test/api/trpc/content.spells.saveDraft', {
        body: '{}',
        headers: { 'content-length': String(1_048_577) },
        method: 'POST'
      })
    )

    expect(response.status).toBe(413)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
    expect(mocks.handleTrpcFetchRequest).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', undefined],
    ['understated', '1']
  ])('rejects an oversized mixed tRPC batch with a %s content-length', async (_name, length) => {
    const { handleTrpcRequest } = await import('./trpc')
    const headers = length === undefined ? undefined : { 'content-length': length }
    const response = await handleTrpcRequest(
      new Request(
        'https://app.test/api/trpc/application.featureFlags,content.spells.saveDraft?batch=1',
        {
          body: 'x'.repeat(1_048_577),
          headers,
          method: 'POST'
        }
      )
    )

    expect(response.status).toBe(413)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
    expect(mocks.handleTrpcFetchRequest).not.toHaveBeenCalled()
  })

  it('derives the user and super-admin flag from verified JWT claims', async () => {
    mocks.createServerClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: {
            claims: {
              app_metadata: {
                admin: 'true'
              },
              sub: 'admin-user'
            }
          },
          error: null
        })
      }
    })

    const { handleTrpcRequest } = await import('./trpc')
    await handleTrpcRequest(
      new Request('https://app.test/api/trpc/content.races.list', {
        method: 'POST'
      })
    )

    expect(mocks.handleTrpcFetchRequest).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        isSuperAdmin: true,
        userId: 'admin-user'
      })
    )
  })

  it('does not trust persisted user metadata for super-admin authorization', async () => {
    const getClaims = vi.fn().mockResolvedValue({
      data: {
        claims: {
          app_metadata: {},
          sub: 'normal-user'
        }
      },
      error: null
    })
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          app_metadata: {
            admin: true
          },
          id: 'normal-user'
        }
      },
      error: null
    })
    mocks.createServerClient.mockReturnValue({
      auth: {
        getClaims,
        getUser
      }
    })

    const { handleTrpcRequest } = await import('./trpc')
    await handleTrpcRequest(
      new Request('https://app.test/api/trpc/content.races.list', {
        method: 'POST'
      })
    )

    expect(getClaims).toHaveBeenCalledTimes(1)
    expect(getUser).not.toHaveBeenCalled()
    expect(mocks.handleTrpcFetchRequest).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        isSuperAdmin: false,
        userId: 'normal-user'
      })
    )
  })
})
