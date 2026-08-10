import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.hoisted(() => vi.fn())

vi.mock('@supabase/supabase-js', () => ({ createClient }))

import { createSupabaseClient } from './supabaseClient.js'

describe('createSupabaseClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('forwards the request IP for Supabase Auth rate limiting', () => {
    createSupabaseClient('203.0.113.10')

    expect(createClient).toHaveBeenCalledWith('https://project.supabase.co', 'sb_secret_test', {
      global: { headers: { 'sb-forwarded-for': '203.0.113.10' } }
    })
  })
})
