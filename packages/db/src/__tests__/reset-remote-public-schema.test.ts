import { describe, expect, it } from 'vitest'

import {
  assertRemoteDatabaseConnectionString,
  parseRemoteSchemaResetTarget,
  readCanonicalMigrationStages
} from '../scripts/resetRemotePublicSchema.js'

describe('remote public-schema reset target', () => {
  it.each([
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    'postgresql://postgres:postgres@localhost:54322/postgres',
    'postgresql://postgres:postgres@[::1]:54322/postgres'
  ])('rejects local database URL %s', (connectionString) => {
    expect(() => assertRemoteDatabaseConnectionString(connectionString)).toThrow(
      'must not point to a local database'
    )
  })

  it('accepts a hosted session-pooler URL', () => {
    expect(() =>
      assertRemoteDatabaseConnectionString(
        'postgresql://postgres.project:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
      )
    ).not.toThrow()
  })

  it('requires an explicit remote target', () => {
    expect(() => parseRemoteSchemaResetTarget([])).toThrow(
      'Pass exactly one of --staging or --production.'
    )
    expect(() => parseRemoteSchemaResetTarget(['--staging', '--production'])).toThrow(
      'Pass exactly one of --staging or --production.'
    )
    expect(parseRemoteSchemaResetTarget(['--staging'])).toBe('staging')
    expect(parseRemoteSchemaResetTarget(['--production'])).toBe('production')
  })

  it('loads the full canonical migration chain as lock-bounded SQL stages', async () => {
    const stages = await readCanonicalMigrationStages()

    expect(stages.length).toBeGreaterThan(100)
    expect(
      stages.some((stage) => stage.sql.includes('CREATE TABLE IF NOT EXISTS public.systems'))
    ).toBe(true)
    expect(
      stages.some(
        (stage) =>
          stage.sql.includes("'user_' || left(md5(auth_user.id::text), 24)") &&
          stage.sql.includes('FROM auth.users AS auth_user')
      )
    ).toBe(true)
    expect(
      stages.some((stage) => stage.sql.includes('add column command_state jsonb not null'))
    ).toBe(true)
  })
})
