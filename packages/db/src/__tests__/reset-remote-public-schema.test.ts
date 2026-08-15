import { describe, expect, it } from 'vitest'

import {
  assertRemoteDatabaseConnectionString,
  readPublicSchemaBootstrapStages
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

  it('loads the canonical schema as lock-bounded SQL stages', async () => {
    const stages = await readPublicSchemaBootstrapStages()

    expect(stages.length).toBeGreaterThan(40)
    expect(stages.every((stage) => !stage.sql.includes('\\i '))).toBe(true)
    expect(stages.every((stage) => !stage.sql.includes('\\set '))).toBe(true)
    expect(
      stages.some((stage) => stage.sql.includes('CREATE TABLE IF NOT EXISTS public.systems'))
    ).toBe(true)
  })
})
