import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('system ruleset identity persistence', () => {
  const canonical = read('packages/db/src/domains/subjects/tables/systems.sql')
  const bootstrapMigration = read('supabase/migrations/20260316000100_bootstrap_bundle.sql')
  const forwardMigration = read(
    'supabase/migrations/20260720160349_add_system_ruleset_identity.sql'
  )

  it('requires a ruleset code and version in canonical system storage', () => {
    for (const source of [canonical, bootstrapMigration]) {
      expect(source).toContain('ruleset_code text NOT NULL')
      expect(source).toContain('ruleset_version text NOT NULL')
    }
  })

  it('upgrades databases that already applied the bootstrap migration', () => {
    expect(forwardMigration).toContain('ADD COLUMN IF NOT EXISTS ruleset_code text')
    expect(forwardMigration).toContain('ADD COLUMN IF NOT EXISTS ruleset_version text')
    expect(forwardMigration).toContain("WHERE id = '00000000-0000-0000-0000-000000000001'")
    expect(forwardMigration).toContain("ruleset_code = 'dnd5e'")
    expect(forwardMigration).toContain("ruleset_version = '2014'")
    expect(forwardMigration).toContain('ALTER COLUMN ruleset_code SET NOT NULL')
    expect(forwardMigration).toContain('ALTER COLUMN ruleset_version SET NOT NULL')
  })
})

describe('deployed SRD seed schema reconciliation', () => {
  const migration = read('supabase/migrations/20260720162435_reconcile_srd_seed_schema.sql')

  it('forwards every seed-required column missing from the deployed bootstrap', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS requires_attunement boolean')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS section_code text')
    expect(migration).toContain('RENAME COLUMN saving_throw_kind TO dc_method')
    expect(migration).toContain('RENAME COLUMN dc TO base_dc')
    expect(migration).toContain("SET dc_method = 'FIXED_DC'")
  })

  it('forwards every seed-required table missing from the deployed bootstrap', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.facet_predicate_class_items')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.feat_feat_grants')
    expect(migration).toContain(
      'ALTER TABLE public.facet_predicate_class_items ENABLE ROW LEVEL SECURITY'
    )
    expect(migration).toContain('ALTER TABLE public.feat_feat_grants ENABLE ROW LEVEL SECURITY')
  })
})
