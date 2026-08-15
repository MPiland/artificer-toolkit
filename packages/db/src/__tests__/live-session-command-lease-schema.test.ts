import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('live-session command lease schema', () => {
  const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
  const migration = read('supabase/migrations/20260815010000_live_session_command_leases.sql')
  const bundle = read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql')
  const generatedTypes = read('packages/db/src/types/supabase.database.ts')

  it('keeps one private expiring command authority per Campaign session', () => {
    for (const source of [canonical, migration, bundle]) {
      expect(source).toContain('CREATE TABLE IF NOT EXISTS public.live_session_command_leases')
      expect(source).toContain(
        'session_id uuid PRIMARY KEY REFERENCES public.campaign_sessions (id) ON DELETE CASCADE'
      )
      expect(source).toContain(
        'authority_id text NOT NULL CHECK (char_length(authority_id) BETWEEN 1 AND 128)'
      )
      expect(source).toContain('expires_at timestamptz NOT NULL')
      expect(source).toContain(
        'ALTER TABLE public.live_session_command_leases ENABLE ROW LEVEL SECURITY'
      )
      expect(source).toContain(
        'REVOKE ALL ON TABLE public.live_session_command_leases FROM anon, authenticated'
      )
    }
    expect(generatedTypes).toContain('live_session_command_leases:')
  })
})
