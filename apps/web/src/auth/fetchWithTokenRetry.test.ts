import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTokenRetry } from './fetchWithTokenRetry'

const tokenUrl = 'http://localhost/api/auth/convex/token'
const fetchMock = vi.fn<typeof fetch>()

function limited(retryAfter?: string) {
  return new Response('{}', {
    status: 429,
    headers: retryAfter ? { 'x-retry-after': retryAfter } : {}
  })
}

describe('fetchWithTokenRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retries a 429 token request after the server retry delay and returns the recovered token', async () => {
    fetchMock
      .mockResolvedValueOnce(limited('3'))
      .mockResolvedValueOnce(Response.json({ token: 'jwt' }))

    const result = fetchWithTokenRetry(tokenUrl, { method: 'GET' })
    await vi.advanceTimersByTimeAsync(2999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)

    expect((await result).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries server errors and network failures with backoff', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ token: 'jwt' }))

    const result = fetchWithTokenRetry(tokenUrl)
    await vi.advanceTimersByTimeAsync(500 + 1000)

    expect((await result).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns a definitive no-session response without retrying', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

    expect((await fetchWithTokenRetry(tokenUrl)).status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stops after bounded retries and returns the last transient response', async () => {
    fetchMock.mockImplementation(async () => limited('1'))

    const result = fetchWithTokenRetry(tokenUrl)
    await vi.advanceTimersByTimeAsync(4000)

    expect((await result).status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('does not retry other auth requests', async () => {
    fetchMock.mockResolvedValueOnce(limited('1'))

    const response = await fetchWithTokenRetry('http://localhost/api/auth/sign-in/email', {
      method: 'POST'
    })

    expect(response.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
