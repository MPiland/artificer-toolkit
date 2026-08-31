import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const root = process.cwd()
const canonical = normalizeSql(
  readFileSync(join(root, 'packages/db/src/domains/encounters/tables/encounters.sql'), 'utf8')
)
const migration = normalizeSql(
  readFileSync(join(root, 'supabase/migrations/20260807170000_encounters.sql'), 'utf8')
)
const idempotencyMigration = readFileSync(
  join(root, 'supabase/migrations/20260809010000_encounter_template_idempotency.sql'),
  'utf8'
)
const rulePackMigration = readFileSync(
  join(root, 'supabase/migrations/20260813010000_phase_07_rule_packs.sql'),
  'utf8'
)
const blueprintMigration = normalizeSql(
  readFileSync(join(root, 'supabase/migrations/20260825062000_encounter_blueprints.sql'), 'utf8')
)
const automationMigration = normalizeSql(
  readFileSync(
    join(root, 'supabase/migrations/20260825064000_campaign_encounter_automation_snapshots.sql'),
    'utf8'
  )
)
const initiativePolicyMigration = normalizeSql(
  readFileSync(
    join(root, 'supabase/migrations/20260828020000_initiative_policy_foundation.sql'),
    'utf8'
  )
)
const bootstrapBundle = normalizeSql(
  readFileSync(
    join(root, 'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'),
    'utf8'
  )
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
  ])('persists Blueprint command idempotency in the %s', (_label, sql) => {
    expect(sql).toContain('command_id uuid NOT NULL')
    expect(sql).toContain('command_fingerprint text NOT NULL')
    expect(sql).toContain('owner_user_id, command_id')
  })

  it('backfills legacy Blueprints before requiring Blueprint command idempotency', () => {
    expect(idempotencyMigration).toContain('ADD COLUMN IF NOT EXISTS command_id uuid')
    expect(idempotencyMigration).toContain('ADD COLUMN IF NOT EXISTS command_fingerprint text')
    expect(idempotencyMigration).toContain('SET command_id = gen_random_uuid()')
    expect(idempotencyMigration).toContain("command_fingerprint = 'legacy:' || id::text")
    expect(idempotencyMigration).toContain('ALTER COLUMN command_id SET NOT NULL')
    expect(idempotencyMigration).toContain('ALTER COLUMN command_fingerprint SET NOT NULL')
  })

  it('keeps Blueprint idempotency metadata internal and pages table rolls in SQL', () => {
    expect(repository).toContain('async findBlueprintByOwnerCommand')
    expect(repository).toContain('commandFingerprint: String(row.command_fingerprint)')
    expect(repository).toContain('commandId: string')
    expect(repository).toContain('ON CONFLICT (owner_user_id, command_id) DO NOTHING')
    expect(repository).toContain('Promise<EncounterBlueprintRecord | null>')
    expect(repository).toMatch(/visibility:\s*["']ALL["'] \| ["']TABLE["'] = ["']ALL["']/)
    expect(repository).toContain("event.command_type IN ('ROLL_ENEMY_ACTION', 'RESOLVE_ACTION')")
    expect(repository).toContain("event.command_payload->>'visibility' = 'TABLE'")
  })

  it('fails closed for cross-System legacy rows and normalizes Custom System snapshots', () => {
    expect(blueprintMigration).toContain('Legacy Encounter Blueprint enemy System conflicts')
    expect(blueprintMigration).toContain('Legacy Encounter actor System conflicts')
    expect(blueprintMigration).toContain("enemy.value ->> 'kind' = 'CUSTOM'")
    expect(blueprintMigration).toContain("actor.kind = 'CUSTOM'")
    expect(blueprintMigration).toContain("'{snapshot,systemId}'")
  })

  it('backfills ownership before checksum completeness and uses canonical JSON checksum text', () => {
    expect(
      blueprintMigration.indexOf('owner_user_id IS NULL OR game_system_id IS NULL')
    ).toBeLessThan(blueprintMigration.indexOf('encounter_blueprint_canonical_json'))
    expect(blueprintMigration.indexOf('encounter_blueprint_canonical_json')).toBeLessThan(
      blueprintMigration.indexOf('setup_checksum IS NULL')
    )
    expect(blueprintMigration.indexOf('ECMAScript JSON number exponent thresholds')).toBeLessThan(
      blueprintMigration.indexOf('encounter_blueprint_canonical_json')
    )
    expect(blueprintMigration).toContain('1000000000000000000000')
    expect(blueprintMigration).toContain('0.000001')
    expect(blueprintMigration).toContain('$.** ? (@.type() == "number"')
    expect(blueprintMigration).toContain('ORDER BY entry.key COLLATE "C"')
    expect(blueprintMigration).toContain('ORDER BY entry.ordinality')
  })

  it('keeps Blueprint update receipts on the closed DTO boundary', () => {
    expect(repository).toContain('resultPayload: encounterBlueprintDtoSchema.parse(')
    expect(repository).toContain('const resultPayload = encounterBlueprintDtoSchema.parse(')
  })

  it('persists checked Campaign automation snapshots for new Encounters', () => {
    expect(canonical).toContain("automation_mode text NOT NULL DEFAULT 'ASSISTED'")
    expect(canonical).toContain("manual_reminder_mode text NOT NULL DEFAULT 'OFF'")
    expect(automationMigration).toContain('ALTER TABLE public.campaign_play_settings')
    expect(automationMigration).toContain('ALTER TABLE public.encounters')
    expect(automationMigration).toContain("automation_mode IN ('AUTOMATIC', 'ASSISTED', 'MANUAL')")
    expect(automationMigration).toContain("manual_reminder_mode IN ('OFF', 'SUBTLE')")
  })

  it('pins complete initiative policy snapshots while Campaign settings retain definition identities', () => {
    expect(initiativePolicyMigration).toContain('initiative_policy_definition_id uuid')
    expect(initiativePolicyMigration).toContain('initiative_tie_definition_id uuid')
    expect(initiativePolicyMigration).toContain(
      'campaign_play_settings_initiative_policy_definition_fk'
    )
    expect(initiativePolicyMigration).toContain('initiative_policy_snapshot jsonb')
    expect(initiativePolicyMigration).toContain('initiative_policy_snapshot_checksum text')
    expect(canonical).toContain('initiative_policy_snapshot jsonb')
    expect(repository).toContain('encounterInitiativePolicySnapshotDtoSchema.parse')
    expect(repository).toContain('checksumCanonicalJson(initiativePolicySnapshot)')
  })

  it.each([
    ['canonical table', canonical],
    ['initiative policy migration', initiativePolicyMigration],
    ['bootstrap bundle', bootstrapBundle]
  ])('locks the parent Encounter before enforcing the %s actor capacity', (_label, sql) => {
    expect(sql).toContain('FUNCTION public.assert_encounter_actor_capacity()')
    expect(sql).toContain('WHERE encounter.id = NEW.encounter_id')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('WHERE actor.encounter_id = NEW.encounter_id')
    expect(sql).toContain('>= 100')
    expect(sql).toContain('TRIGGER encounter_actors_capacity_before_insert')
  })

  it.each([
    ['canonical table', canonical],
    ['initiative policy migration', initiativePolicyMigration]
  ])('requires optional combat snapshots and checksums together in the %s', (_label, sql) => {
    expect(sql).toContain(
      '(optional_combat_snapshot IS NULL AND optional_combat_snapshot_checksum IS NULL)'
    )
    expect(sql).toContain('optional_combat_snapshot IS NOT NULL')
    expect(sql).toContain('optional_combat_snapshot_checksum IS NOT NULL')
    expect(sql).toContain("jsonb_typeof(optional_combat_snapshot) = 'object'")
    expect(sql).toContain("optional_combat_snapshot_checksum ~ '^[a-f0-9]{64}$'")
  })
})
