import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function normalizeSql(source: string): string {
  return source
    .replace(/\s+/gu, ' ')
    .replace(/\(\s+/gu, '(')
    .replace(/\s+\)/gu, ')')
    .trim()
    .toLowerCase()
}

describe('Campaign Character mechanics projection schema', () => {
  it('keeps the canonical schema and migration server-only and assignment-bound', () => {
    const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
    const migration = read(
      'supabase/migrations/20260818100000_campaign_character_mechanics_base_references.sql'
    )

    const canonicalNormalized = normalizeSql(canonical)
    expect(canonicalNormalized).toContain('campaign_character_mechanics_projections')
    expect(canonicalNormalized).toContain('primary key (campaign_id, character_id)')
    expect(canonicalNormalized).toContain(
      'campaign_character_assignments (campaign_id, character_id)'
    )
    expect(canonicalNormalized).toContain('on delete cascade')
    expect(canonicalNormalized).toContain('base_mechanics_projection_checksum')
    expect(canonicalNormalized).toContain('mechanical_context_checksum')

    for (const source of [canonical, migration]) {
      const normalized = normalizeSql(source)
      expect(normalized).toContain('projection_kind')
      expect(normalized).toContain('base_reference')
      expect(normalized).toContain('materialized')
      expect(normalized).toContain('rule_policy_input is null')
      expect(normalized).toContain('rule_policy_output is null')
      expect(normalized).toContain('rule_policy_input is not null')
      expect(normalized).toContain('rule_policy_output is not null')
    }

    expect(canonicalNormalized).toContain('enable row level security')
    expect(canonicalNormalized).toContain(
      'revoke all on table public.campaign_character_mechanics_projections'
    )
  })
})
