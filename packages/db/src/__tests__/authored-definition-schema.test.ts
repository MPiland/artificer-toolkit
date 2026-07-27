import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

const raceSchema = read('packages/db/src/domains/subjects/tables/races.sql')
const classSchema = read('packages/db/src/domains/subjects/tables/classes.sql')
const equipmentSchema = read('packages/db/src/domains/subjects/tables/equipment.sql')
const spellSchema = read('packages/db/src/domains/subjects/tables/spells.sql')

describe('authored definition revision persistence', () => {
  const canonical = read('packages/db/src/domains/subjects/tables/authored_definitions.sql')
  const generatedBundle = read(
    'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'
  )
  const bootstrapMigration = read('supabase/migrations/20260316000100_bootstrap_bundle.sql')
  const routeIdMigration = read('supabase/migrations/20260510123258_authored_route_ids.sql')
  const optimizedRlsMigration = read(
    'supabase/migrations/20260521185305_optimize_rls_auth_initplans.sql'
  )
  const forwardStorageMigration = read(
    'supabase/migrations/20260719014119_create_authored_definition_storage.sql'
  )

  it('uses stable definitions and immutable complete revisions as canonical storage', () => {
    for (const source of [canonical, generatedBundle, bootstrapMigration]) {
      expect(source).toContain('CREATE TABLE IF NOT EXISTS public.authored_definitions')
      expect(source).toContain('CREATE TABLE IF NOT EXISTS public.authored_definition_revisions')
      expect(source).toContain('payload jsonb NOT NULL')
      expect(source).toContain('active_revision_id uuid')
      expect(source).toContain('draft_revision_id uuid')
      expect(source).toContain('CONSTRAINT authored_definitions_owner_chk CHECK')
      expect(source).toContain('CONSTRAINT authored_definitions_active_revision_fk FOREIGN KEY')
      expect(source).toContain('CONSTRAINT authored_definitions_draft_revision_fk FOREIGN KEY')
      expect(source).not.toContain('authored_subject_drafts')
    }
  })

  it('keeps the generated bootstrap and deployed bootstrap migration identical', () => {
    expect(bootstrapMigration).toBe(generatedBundle)
  })

  it('does not recreate the retired draft sidecar in later migrations', () => {
    expect(routeIdMigration).not.toContain('authored_subject_drafts')
    expect(optimizedRlsMigration).not.toContain('authored_subject_drafts')
    expect(routeIdMigration).toContain('FROM public.authored_definitions')
  })

  it('creates canonical authored storage for databases that already applied the bootstrap', () => {
    expect(forwardStorageMigration).toContain(
      'CREATE TABLE IF NOT EXISTS public.authored_definitions'
    )
    expect(forwardStorageMigration).toContain(
      'CREATE TABLE IF NOT EXISTS public.authored_definition_revisions'
    )
    expect(forwardStorageMigration).toContain("conname = 'authored_definitions_active_revision_fk'")
    expect(forwardStorageMigration).toContain("conname = 'authored_definitions_draft_revision_fk'")
    expect(forwardStorageMigration).toContain(
      'ALTER TABLE public.authored_definitions ENABLE ROW LEVEL SECURITY'
    )
  })
})

describe('authored root reference integrity', () => {
  it('enforces same-system parent relationships for inherited roots', () => {
    expect(raceSchema).toContain(
      'CONSTRAINT races_parent_system_fk FOREIGN KEY (parent_race_id, system_id)'
    )
    expect(classSchema).toContain(
      'CONSTRAINT classes_parent_system_fk FOREIGN KEY (parent_class_id, system_id)'
    )
    expect(equipmentSchema).toContain(
      'CONSTRAINT equipment_parent_system_fk FOREIGN KEY (parent_equipment_id, system_id)'
    )
  })

  it('keeps spell class references backed by a database foreign key', () => {
    expect(spellSchema).toMatch(/class_id uuid NOT NULL\s+REFERENCES public\.classes\(id\)/)
  })
})
