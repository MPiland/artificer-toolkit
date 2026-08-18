import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('Campaign Character mechanics projection schema', () => {
  it('keeps the canonical schema and migration server-only and assignment-bound', () => {
    const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
    const migration = read(
      'supabase/migrations/20260818050000_campaign_character_mechanics_projections.sql'
    )

    for (const source of [canonical, migration]) {
      const normalized = source.toLowerCase()
      expect(normalized).toContain('campaign_character_mechanics_projections')
      expect(normalized).toContain('primary key (campaign_id, character_id)')
      expect(normalized).toContain('campaign_character_assignments (campaign_id, character_id)')
      expect(normalized).toContain('on delete cascade')
      expect(normalized).toContain('base_mechanics_projection_checksum')
      expect(normalized).toContain('mechanical_context_checksum')
      expect(normalized).toContain("jsonb_typeof(rule_policy_input) = 'object'")
      expect(normalized).toContain("jsonb_typeof(rule_policy_output) = 'object'")
      expect(normalized).toContain('enable row level security')
      expect(normalized).toContain('revoke all on table public.campaign_character_mechanics_projections')
    }
  })
})
