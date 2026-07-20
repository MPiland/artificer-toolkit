import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getApplicationFeatureFlags: vi.fn(),
  getBlockedAuthRequest: vi.fn(),
  getRequestUrl: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  signUp: vi.fn()
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: <TResult>(callback: (context: { data: unknown }) => TResult) => callback
    })
  })
}))

vi.mock('@tanstack/react-start/server', () => ({
  getRequestUrl: mocks.getRequestUrl
}))

vi.mock('@artificer-toolkit/apis/application-config', () => ({
  getApplicationFeatureFlags: mocks.getApplicationFeatureFlags
}))

vi.mock('#supabase/server.server', () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient
}))

vi.mock('./requestSecurity', () => ({
  getBlockedAuthRequest: mocks.getBlockedAuthRequest
}))

import { signUpFn } from './signUpFn'

describe('signUpFn', () => {
  const input = {
    email: 'player@example.com',
    name: 'Morgan Emberfall',
    password: 'password123'
  }

  function configureEnabledSignUp() {
    mocks.getApplicationFeatureFlags.mockReturnValue({ publicSignUpEnabled: true })
    mocks.getBlockedAuthRequest.mockReturnValue(null)
    mocks.getRequestUrl.mockReturnValue(new URL('https://app.example.test/sign-up'))
    mocks.getSupabaseServerClient.mockReturnValue({
      auth: {
        signUp: mocks.signUp
      }
    })
  }

  it('rejects public registration before calling Supabase when disabled', async () => {
    mocks.getApplicationFeatureFlags.mockReturnValue({ publicSignUpEnabled: false })
    mocks.getBlockedAuthRequest.mockReturnValue(null)

    await expect(signUpFn({ data: input })).resolves.toEqual({
      ok: false,
      message: 'Public sign-up is currently disabled.',
      session: null
    })
    expect(mocks.getSupabaseServerClient).not.toHaveBeenCalled()
  })

  it('preserves the existing email/password registration request when enabled', async () => {
    configureEnabledSignUp()
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: null
    })

    await expect(signUpFn({ data: input })).resolves.toEqual({ ok: true, session: null })
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      options: {
        data: { display_name: input.name },
        emailRedirectTo: 'https://app.example.test/auth/confirmed'
      }
    })
  })
})
