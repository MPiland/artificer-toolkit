import { createClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_SEED_OWNER_EMAIL,
  findSeedOwnerUserById,
  readSeedOwnerEnvironment,
  type SeedOwnerEnvironment
} from '../scripts/seedOwner.js'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

const environment: SeedOwnerEnvironment = {
  connectionString: 'postgresql://localhost/postgres',
  email: 'seed@local.invalid',
  supabaseSecretKey: 'secret',
  supabaseUrl: 'http://localhost:54321'
}

describe('seed owner configuration', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllEnvs())

  it('uses a clearly local default seed-owner email outside production', () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', 'secret')
    vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')

    expect(readSeedOwnerEnvironment(false, environment.connectionString).email).toBe(
      DEFAULT_SEED_OWNER_EMAIL
    )
    expect(DEFAULT_SEED_OWNER_EMAIL.endsWith('.invalid')).toBe(true)
  })

  it('requires an explicit production seed-owner email', () => {
    vi.stubEnv('PROD_DATABASE_CONNECTION_STRING', environment.connectionString)
    vi.stubEnv('PROD_SUPABASE_SECRET_KEY', 'secret')
    vi.stubEnv('PROD_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('PROD_SEED_OWNER_EMAIL', '')

    expect(() => readSeedOwnerEnvironment(true)).toThrow('PROD_SEED_OWNER_EMAIL is required')
  })

  it('looks up a configured owner id directly', async () => {
    const user = { id: '11111111-1111-4111-8111-111111111111', email: environment.email }
    const getUserById = vi.fn().mockResolvedValue({ data: { user }, error: null })
    const listUsers = vi.fn()
    vi.mocked(createClient).mockReturnValue({
      auth: { admin: { getUserById, listUsers } }
    } as never)

    await expect(findSeedOwnerUserById(environment, user.id)).resolves.toBe(user)
    expect(getUserById).toHaveBeenCalledWith(user.id)
    expect(listUsers).not.toHaveBeenCalled()
  })
})
