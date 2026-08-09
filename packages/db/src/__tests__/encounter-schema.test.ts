import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const canonical = readFileSync(
  join(root, 'packages/db/src/domains/encounters/tables/encounters.sql'),
  'utf8'
)
const migration = readFileSync(
  join(root, 'supabase/migrations/20260807170000_encounters.sql'),
  'utf8'
)
const repository = readFileSync(join(root, 'packages/db/src/repositories/encounter.ts'), 'utf8')

describe('encounter persistence schema', () => {
  it.each([
    ['canonical tables', canonical],
    ['deployed migration', migration]
  ])('keeps %s authoritative and browser-denied', (_label, sql) => {
    expect(sql).toContain('CREATE TABLE')
    expect(sql).toContain('name text NOT NULL')
    expect(sql).toContain('encounters_one_active_per_campaign_idx')
    expect(sql).toContain('UNIQUE (encounter_id, command_id)')
    expect(sql).toContain('campaign_id, command_id')
    expect(sql).toContain('OFFSET 2000')
    expect(sql).toContain('REVOKE ALL ON TABLE')
  })

  it('lists prepared work and counts only saved active work against tiers', () => {
    expect(repository).toContain('async listForCampaign')
    expect(repository).toContain("encounter.status IN ('PREPARED', 'ACTIVE')")
  })
})
