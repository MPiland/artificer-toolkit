import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const canonical = read('packages/db/src/domains/rules/tables/rule_packs.sql')
const migration = read('supabase/migrations/20260813010000_phase_07_rule_packs.sql')
const convergenceMigration = read('supabase/migrations/20260813020000_rule_revision_metadata.sql')
const encounters = read('packages/db/src/domains/encounters/tables/encounters.sql')
const characters = read('packages/db/src/domains/subjects/tables/characters.sql')
const crossDomainForeignKeys = read(
  'packages/db/src/domains/bootstrap/constraints/cross_domain_foreign_keys.sql'
)

describe('rule pack persistence schema', () => {
  it.each([
    ['canonical tables', canonical],
    ['forward migration', migration]
  ])('keeps %s private and integrity constrained', (_label, source) => {
    expect(source).toContain('UNIQUE (ruleset_code, version)')
    expect(source).toContain("jsonb_typeof(document) = 'object'")
    expect(source).toContain("checksum ~ '^[0-9a-f]{64}$'")
    expect(source).toContain('ON DELETE RESTRICT')
    expect(source).toContain('rule_pack_revisions_one_draft_per_pack_idx')
    expect(source).toContain('WHERE activated_at IS NULL')
    expect(source).toContain('ENABLE ROW LEVEL SECURITY')
    expect(source).toContain('FORCE ROW LEVEL SECURITY')
    expect(source).toContain('REVOKE ALL ON TABLE public.rule_packs FROM anon, authenticated')
    expect(source).toContain(
      'REVOKE ALL ON TABLE public.rule_pack_revisions FROM anon, authenticated'
    )
  })

  it('requires bounded evaluator metadata on canonical tables', () => {
    const source = canonical
    expect(source).toContain("evaluator_kind text NOT NULL DEFAULT 'ZEN'")
    expect(source).toContain("CHECK (evaluator_kind = 'ZEN')")
    expect(source).toContain("evaluator_version text NOT NULL DEFAULT '0.54.0'")
    expect(source).toContain('model_contract_version integer NOT NULL DEFAULT 5')
    expect(source).toContain('model_contract_version BETWEEN 1 AND 10000')
  })

  it('upgrades drafts without mutating activated revision metadata', () => {
    const migration = read('supabase/migrations/20260814060000_rule_model_contract_v5.sql')
    expect(migration).toContain('ALTER COLUMN model_contract_version SET DEFAULT 5')
    expect(migration).toContain('SET model_contract_version = 5')
    expect(migration).toContain('WHERE activated_at IS NULL')
  })

  it('keeps character revision pins nullable and restricts revision deletion', () => {
    expect(characters).toContain('rule_pack_revision_id uuid')
    expect(crossDomainForeignKeys).toContain('characters_rule_pack_revision_id_fkey')
    expect(crossDomainForeignKeys).toContain('REFERENCES public.rule_pack_revisions (id)')
    expect(crossDomainForeignKeys).toContain('ON DELETE RESTRICT')
    expect(convergenceMigration).toContain('ALTER TABLE public.characters')
    expect(convergenceMigration).toContain('ADD COLUMN IF NOT EXISTS rule_pack_revision_id')
  })

  it.each([
    ['canonical tables', canonical],
    ['forward migration', migration]
  ])(
    'allows only activated, pack-owned active pointers and locks activated rows',
    (_label, source) => {
      expect(source).toContain('validate_rule_pack_active_revision')
      expect(source).toContain('revision.rule_pack_id = NEW.id')
      expect(source).toContain('revision.activated_at IS NOT NULL')
      expect(source).toContain('reject_activated_rule_pack_revision_mutation')
      expect(source).toContain('Activated rule pack revisions are immutable.')
    }
  )

  it('pins encounters to an optional immutable rule-pack revision', () => {
    expect(encounters).toContain(
      'rule_pack_revision_id uuid REFERENCES public.rule_pack_revisions (id) ON DELETE RESTRICT'
    )
    expect(migration).toContain('ALTER TABLE public.encounters')
  })
})
