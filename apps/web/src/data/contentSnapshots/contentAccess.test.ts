import { describe, expect, it, vi } from 'vitest'
import { createContentAccessCache } from './contentAccess'

const ISSUED_AT = Date.parse('2026-09-28T12:00:00.000Z')

describe('content access token cache', () => {
  it('reuses a token until a minute before it expires, then issues a new one', async () => {
    let now = ISSUED_AT
    const issue = vi
      .fn()
      .mockResolvedValueOnce({ token: 'first', expiresAt: '2026-09-28T12:10:00.000Z' })
      .mockResolvedValueOnce({ token: 'second', expiresAt: '2026-09-28T12:19:00.000Z' })
    const getToken = createContentAccessCache(issue, () => now)

    await expect(getToken(false)).resolves.toBe('first')
    now = ISSUED_AT + 8 * 60_000
    await expect(getToken(false)).resolves.toBe('first')
    now = ISSUED_AT + 9 * 60_000
    await expect(getToken(false)).resolves.toBe('second')
    expect(issue).toHaveBeenCalledTimes(2)
  })

  it('issues once for concurrent requests and on demand when a token was refused', async () => {
    const issue = vi
      .fn()
      .mockResolvedValueOnce({ token: 'first', expiresAt: '2026-09-28T12:10:00.000Z' })
      .mockResolvedValueOnce({ token: 'refreshed', expiresAt: '2026-09-28T12:10:00.000Z' })
    const getToken = createContentAccessCache(issue, () => ISSUED_AT)

    await expect(Promise.all([getToken(false), getToken(false)])).resolves.toEqual([
      'first',
      'first'
    ])
    await expect(getToken(true)).resolves.toBe('refreshed')
    await expect(getToken(false)).resolves.toBe('refreshed')
    expect(issue).toHaveBeenCalledTimes(2)
  })
})
