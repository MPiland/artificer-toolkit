import type { User } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { getRouter } from '#app/router'

describe('router context security', () => {
  it('does not serialize auth tokens into the route payload context', () => {
    const user = {
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00.000Z',
      id: 'user-1',
      user_metadata: {}
    } as User
    const router = getRouter(user)
    const payload = JSON.stringify(router.options.context)

    expect(payload).not.toContain('accessToken')
    expect(payload).not.toContain('access_token')
    expect(payload).not.toContain('refresh_token')
    expect(payload).not.toContain('Authorization')
    expect(payload).not.toContain('Bearer')
  })
})
