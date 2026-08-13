import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const canonical = read('packages/db/src/domains/rules/tables/rule_packs.sql')
const migration = read('supabase/migrations/20260813010000_phase_07_rule_packs.sql')
const encounters = read('packages/db/src/domains/encounters/tables/encounters.sql')

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
