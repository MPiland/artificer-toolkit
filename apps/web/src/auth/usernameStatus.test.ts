import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getUsernameStatus } from './usernameStatus'

const isUsernameAvailable = vi.hoisted(() => vi.fn())
vi.mock('./betterAuthClient', () => ({ betterAuthClient: { isUsernameAvailable } }))

describe('Better Auth username availability', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects reserved or malformed usernames before making a request', async () => {
    expect(await getUsernameStatus('admin')).toEqual({ status: 'not_allowed' })
    expect(await getUsernameStatus('x')).toEqual({ status: 'not_allowed' })
    expect(isUsernameAvailable).not.toHaveBeenCalled()
  })

  it.each([
    [true, 'available'],
    [false, 'taken']
  ])('maps availability without changing display case', async (available, status) => {
    isUsernameAvailable.mockResolvedValue({ data: { available }, error: null })
    expect(await getUsernameStatus('Morgan')).toEqual({ status })
    expect(isUsernameAvailable).toHaveBeenCalledWith({ username: 'Morgan' })
  })

  it.each([
    { data: null, error: { message: 'private' } },
    { data: null, error: null }
  ])('fails safely on an unavailable response', async (result) => {
    isUsernameAvailable.mockResolvedValue(result)
    await expect(getUsernameStatus('Morgan')).rejects.toThrow(
      'Username availability is temporarily unavailable.'
    )
  })
})
