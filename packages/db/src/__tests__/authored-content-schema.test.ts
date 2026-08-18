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
const versionedProjectionsSchema = read(
  'packages/db/src/domains/subjects/tables/versioned_projections.sql'
)
const routeSchema = read('packages/db/src/domains/subjects/tables/authored_route_ids.sql')
const campaignSchema = read('packages/db/src/domains/campaigns/tables/campaigns.sql')

describe('authored draft and import persistence', () => {
  const canonical = read('packages/db/src/domains/subjects/tables/authored_content.sql')
  const generatedBundle = read(
    'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'
  )
  const migration = read(
    'supabase/migrations/20260804203049_remove_authored_revisions_add_import_refs.sql'
  )

  it('keeps one owner-scoped draft per authored root', () => {
    for (const source of [canonical, generatedBundle, migration]) {
      expect(source).toContain('authored_drafts')
      expect(source).toContain('PRIMARY KEY (subject_kind, subject_id)')
      expect(source).toContain('base_active_updated_at timestamptz')
      expect(source).toContain('payload jsonb NOT NULL')
      expect(source).toContain('ALTER TABLE public.authored_drafts ENABLE ROW LEVEL SECURITY')
    }
    expect(canonical).not.toContain('authored_definitions')
    expect(canonical).not.toContain('authored_definition_revisions')
    expect(generatedBundle).not.toContain('authored_definition_revisions')
  })

  it('migrates current drafts and preserves already-stale conflicts', () => {
    expect(migration).toContain('IN SHARE ROW EXCLUSIVE MODE')
    expect(migration).toContain(
      'Cannot remove authored revisions because an active definition has no matching ACTIVE root projection.'
    )
    expect(migration).toContain("active_revision.payload ->> 'label'")
    expect(migration).toContain('revision.id = definition.draft_revision_id')
    expect(migration).toContain("ELSE '-infinity'::timestamptz")
    expect(migration).toContain('DROP TABLE public.authored_definition_revisions')
    expect(migration).toContain('DROP TABLE public.authored_definitions')
  })

  it('stores user-scoped import mappings for authored roots and characters', () => {
    for (const source of [canonical, generatedBundle, migration]) {
      expect(source).toContain('authored_import_refs')
      expect(source).toContain("'DND_BEYOND', 'FOUNDRY_DND5E', 'ARTIFICER_JSON'")
      expect(source).toContain("'CHARACTER'")
      expect(source).toContain('PRIMARY KEY (user_id, source, subject_kind, external_id)')
      expect(source).toContain('idx_authored_import_refs_subject')
    }
  })

  it('derives route visibility from active roots and owned drafts', () => {
    for (const source of [routeSchema, generatedBundle, migration]) {
      expect(source).toContain('can_access_authored_route_id')
      expect(source).toContain('FROM public.authored_drafts')
      expect(source).toContain("status = 'ACTIVE'")
    }

    expect(generatedBundle).toContain('CREATE TABLE IF NOT EXISTS public.authored_route_ids')
    expect(migration).toMatch(/INSERT\s+INTO\s+public\.authored_route_ids/)
    expect(migration).toMatch(
      /REVOKE\s+EXECUTE ON FUNCTION public\.can_access_authored_route_id\s*\(text, uuid\)/
    )
    expect(migration).toContain('greatest(coalesce(max_route_number, 1), sequence_last_value)')
  })

  it('defines Campaign route access only after campaign memberships exist', () => {
    expect(routeSchema).not.toContain('FROM public.campaign_memberships')

    const membershipTableMarker = campaignSchema.indexOf(
      'CREATE TABLE IF NOT EXISTS public.campaign_memberships'
    )
    const campaignRouteAccessMarker = campaignSchema.indexOf(
      'CREATE OR REPLACE FUNCTION public.can_access_authored_route_id'
    )

    expect(membershipTableMarker).toBeGreaterThanOrEqual(0)
    expect(campaignRouteAccessMarker).toBeGreaterThan(membershipTableMarker)

    const generatedMembershipTableMarker = generatedBundle.indexOf(
      'CREATE TABLE IF NOT EXISTS public.campaign_memberships'
    )
    const generatedCampaignRouteAccessMarker = generatedBundle.indexOf(
      'CREATE OR REPLACE FUNCTION public.can_access_authored_route_id',
      generatedMembershipTableMarker
    )

    expect(generatedMembershipTableMarker).toBeGreaterThanOrEqual(0)
    expect(generatedBundle.slice(0, generatedMembershipTableMarker)).not.toContain(
      'FROM public.campaign_memberships'
    )
    expect(generatedCampaignRouteAccessMarker).toBeGreaterThan(generatedMembershipTableMarker)
  })
})

describe('authored root reference integrity', () => {
  it('keeps Class root envelopes independent of legacy starting-equipment rows', () => {
    const generatedBundle = read(
      'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'
    )
    const migration = read(
      'supabase/migrations/20260818010000_authored_root_envelope_constraints.sql'
    )

    expect(classSchema).not.toContain('classes_category_parent_chk')
    expect(generatedBundle).not.toContain('classes_category_parent_chk')
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS classes_category_parent_chk')
  })

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

  it('keeps the Spell catalogue class index bound to its exact authored version', () => {
    const generatedBundle = read(
      'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'
    )
    const migration = read(
      'supabase/migrations/20260818020000_spell_catalog_class_index.sql'
    )

    for (const source of [versionedProjectionsSchema, generatedBundle, migration]) {
      expect(source).toContain('CREATE TABLE IF NOT EXISTS public.spell_catalog_classes')
      expect(source).toContain('CREATE TABLE IF NOT EXISTS public.spell_catalog_index_versions')
      expect(source).toContain('FOREIGN KEY (spell_id, authored_version_id)')
      expect(source).toContain('REFERENCES public.spell_versions (spell_id, id)')
      expect(source).toContain('idx_spell_catalog_classes_class')
      expect(source).toContain('ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED')
      expect(source).toContain('ALTER TABLE public.spell_catalog_classes ENABLE ROW LEVEL SECURITY')
      expect(source).toContain('ALTER TABLE public.spell_catalog_index_versions ENABLE ROW LEVEL SECURITY')
    }
  })
})
