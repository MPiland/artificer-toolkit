import { QueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { getAccountProfileRedirect } from './accountProfileGuard'

const user = { id: 'user-1' } as User

describe('authenticated profile guard', () => {
  it('redirects a missing session before loading profile data', async () => {
    const queryClient = new QueryClient()
    const ensureQueryData = vi.spyOn(queryClient, 'ensureQueryData')

    await expect(getAccountProfileRedirect({ queryClient, user: null })).resolves.toBe('sign-in')
    expect(ensureQueryData).not.toHaveBeenCalled()
  })

  it('redirects a signed-in user without a profile to invitation completion', async () => {
    const queryClient = new QueryClient()
    vi.spyOn(queryClient, 'ensureQueryData').mockResolvedValue(null)

    await expect(getAccountProfileRedirect({ queryClient, user })).resolves.toBe('invite')
  })

  it('allows a signed-in user with a required profile', async () => {
    const queryClient = new QueryClient()
    vi.spyOn(queryClient, 'ensureQueryData').mockResolvedValue({
      username: 'morgan',
      name: null,
      bio: null
    })

    await expect(getAccountProfileRedirect({ queryClient, user })).resolves.toBeNull()
  })
})
