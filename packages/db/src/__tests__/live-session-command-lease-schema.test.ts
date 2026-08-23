import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function normalizeSql(source: string): string {
  return source
    .replace(/\s+/gu, ' ')
    .replace(/\(\s+/gu, '(')
    .replace(/\s+\)/gu, ')')
    .trim()
    .toLowerCase()
}

describe('live-session command lease schema', () => {
  const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
  const migration = read('supabase/migrations/20260815010000_live_session_command_leases.sql')
  const bundle = read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql')
  const generatedTypes = read('packages/db/src/types/supabase.database.ts')

  it('keeps one private expiring command authority per Campaign session', () => {
    for (const source of [canonical, migration, bundle].map(normalizeSql)) {
      expect(source).toContain('create table if not exists public.live_session_command_leases')
      expect(source).toContain(
        'session_id uuid primary key references public.campaign_sessions (id) on delete cascade'
      )
      expect(source).toContain(
        'authority_id text not null check (char_length(authority_id) between 1 and 128)'
      )
      expect(source).toContain('expires_at timestamptz not null')
      expect(source).toContain(
        'alter table public.live_session_command_leases enable row level security'
      )
      expect(source).toContain(
        'revoke all on table public.live_session_command_leases from anon, authenticated'
      )
    }
    expect(generatedTypes).toContain('live_session_command_leases:')
  })
})
