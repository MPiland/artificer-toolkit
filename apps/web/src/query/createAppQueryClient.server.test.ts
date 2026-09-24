// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConvexQueryClient, convexQuery } from '@convex-dev/react-query'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@artificer-toolkit/apis/convex/api'

const mocks = vi.hoisted(() => ({
  request: new Request('https://app.example/backgrounds', { headers: { cookie: 'session=test' } }),
  createClient: vi.fn(),
  setResponseHeader: vi.fn()
}))
vi.mock('@tanstack/react-start', () => ({
  createIsomorphicFn: () => ({ server: (handler: unknown) => ({ client: () => handler }) })
}))
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => mocks.request,
  setResponseHeader: mocks.setResponseHeader
}))
vi.mock('#app/server/auth/convex.server', () => ({
  createAuthenticatedConvexClient: mocks.createClient
}))

import { createAppQueryClient } from './createAppQueryClient'

afterEach(() => vi.resetAllMocks())

describe('authenticated native SSR queries', () => {
  it('authenticates once before parallel consistent reads without caching credentials', async () => {
    const convex = new ConvexQueryClient('https://example.convex.cloud')
    const authenticated = new ConvexHttpClient('https://example.convex.cloud')
    authenticated.setAuth('request-private-jwt')
    const read = vi.spyOn(authenticated, 'consistentQuery').mockResolvedValue(null)
    let finishAuthentication: ((client: ConvexHttpClient) => void) | undefined
    mocks.createClient.mockImplementation(
      () =>
        new Promise<ConvexHttpClient>((resolve) => {
          finishAuthentication = resolve
        })
    )
    const queryClient = createAppQueryClient(convex)
    try {
      const queries = ['first', 'second'].map((id) =>
        queryClient.fetchQuery(
          convexQuery(api.content.details.get, { subjectKind: 'BACKGROUND', id })
        )
      )
      await vi.waitFor(() => expect(mocks.createClient).toHaveBeenCalledOnce())
      expect(read).not.toHaveBeenCalled()
      expect(mocks.createClient).toHaveBeenCalledWith(mocks.request)
      finishAuthentication?.(authenticated)
      expect(await Promise.all(queries)).toEqual([null, null])
      expect(read).toHaveBeenCalledTimes(2)
      expect(convex.serverHttpClient).toBe(authenticated)
      expect(convex.ssrQueryMode).toBe('consistent')
      expect(mocks.setResponseHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
      expect(
        JSON.stringify(
          queryClient
            .getQueryCache()
            .getAll()
            .map((query) => query.state.data)
        )
      ).not.toContain('request-private-jwt')
    } finally {
      queryClient.clear()
      convex.unsubscribe?.()
      await convex.convexClient.close()
    }
  })

  it('fails closed across later reads when authentication fails', async () => {
    const convex = new ConvexQueryClient('https://example.convex.cloud')
    if (!convex.serverHttpClient) throw new Error('SSR client required.')
    const read = vi.spyOn(convex.serverHttpClient, 'consistentQuery')
    mocks.createClient.mockRejectedValue(new Error('Invalid session'))
    const queryClient = createAppQueryClient(convex)
    try {
      for (const id of ['first', 'second']) {
        await expect(
          queryClient.fetchQuery({
            ...convexQuery(api.content.details.get, { subjectKind: 'BACKGROUND', id }),
            retry: false
          })
        ).rejects.toThrow('Invalid session')
      }
      expect(mocks.createClient).toHaveBeenCalledOnce()
      expect(read).not.toHaveBeenCalled()
    } finally {
      queryClient.clear()
      convex.unsubscribe?.()
      await convex.convexClient.close()
    }
  })
})
