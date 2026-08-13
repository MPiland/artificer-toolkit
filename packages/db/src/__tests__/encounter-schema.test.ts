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
const idempotencyMigration = readFileSync(
  join(root, 'supabase/migrations/20260809010000_encounter_template_idempotency.sql'),
  'utf8'
)
const rulePackMigration = readFileSync(
  join(root, 'supabase/migrations/20260813010000_phase_07_rule_packs.sql'),
  'utf8'
)
const bootstrapBundle = readFileSync(
  join(root, 'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'),
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
    expect(sql).toContain('REVOKE ALL ON TABLE')
  })

  it('keeps command receipts and rule-resolution evidence after Phase 07', () => {
    expect(migration).toContain('OFFSET 2000')
    expect(rulePackMigration).toContain('DROP TRIGGER IF EXISTS encounter_events_trim')
    expect(rulePackMigration).toContain('DROP FUNCTION IF EXISTS public.trim_encounter_events')
    expect(canonical).not.toContain('CREATE TRIGGER encounter_events_trim')
  })

  it('lists prepared work and counts only saved active work against tiers', () => {
    expect(repository).toContain('async listForCampaign')
    expect(repository).toContain("encounter.status IN ('PREPARED', 'ACTIVE')")
  })

  it.each([
    ['canonical table', canonical],
    ['bootstrap bundle', bootstrapBundle]
  ])('persists template command idempotency in the %s', (_label, sql) => {
    expect(sql).toContain('command_id uuid NOT NULL')
    expect(sql).toContain('command_fingerprint text NOT NULL')
    expect(sql).toContain('campaign_id, command_id')
  })

  it('backfills legacy templates before requiring template command idempotency', () => {
    expect(idempotencyMigration).toContain('ADD COLUMN IF NOT EXISTS command_id uuid')
    expect(idempotencyMigration).toContain('ADD COLUMN IF NOT EXISTS command_fingerprint text')
    expect(idempotencyMigration).toContain('SET command_id = gen_random_uuid()')
    expect(idempotencyMigration).toContain("command_fingerprint = 'legacy:' || id::text")
    expect(idempotencyMigration).toContain('ALTER COLUMN command_id SET NOT NULL')
    expect(idempotencyMigration).toContain('ALTER COLUMN command_fingerprint SET NOT NULL')
  })

  it('keeps template idempotency metadata internal and pages table rolls in SQL', () => {
    expect(repository).toContain('async findTemplateByCampaignCommand')
    expect(repository).toContain('commandFingerprint: String(row.command_fingerprint)')
    expect(repository).toContain('commandId: string')
    expect(repository).toContain('ON CONFLICT (campaign_id, command_id) DO NOTHING')
    expect(repository).toContain('Promise<EncounterTemplateRecord | null>')
    expect(repository).toContain("visibility: 'ALL' | 'TABLE' = 'ALL'")
    expect(repository).toContain("event.command_type IN ('ROLL_ENEMY_ACTION', 'RESOLVE_ACTION')")
    expect(repository).toContain("event.command_payload->>'visibility' = 'TABLE'")
  })
})
