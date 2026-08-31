import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const root = process.cwd()

function read(relativePath: string): string {
  return normalizeSql(readFileSync(join(root, relativePath), 'utf8'))
}

describe('character play-state persistence schema', () => {
  const characterTables = read('packages/db/src/domains/subjects/tables/characters.sql')
  const generatedBundle = read(
    'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'
  )
  const bootstrapMigration = read('supabase/migrations/20260316000100_bootstrap_bundle.sql')
  const playStateMigration = read(
    'supabase/migrations/20260713090000_character_play_state_persistence.sql'
  )
  const classSpellStateIdentityMigration = read(
    'supabase/migrations/20260714053000_character_class_spell_state_identity.sql'
  )
  const characterAdjustmentTables = read(
    'packages/db/src/domains/subjects/tables/character_sheet_adjustments.sql'
  )
  const adjustmentNoteOnlyMigration = read(
    'supabase/migrations/20260725010000_character_sheet_adjustment_note_only.sql'
  )
  const creatureOriginMigration = read(
    'supabase/migrations/20260727090000_character_creature_origin_kind.sql'
  )
  const startingGoldFormulaMigration = read(
    'supabase/migrations/20260806010000_character_starting_gold_formula.sql'
  )
  const authoredDocumentReferenceCutoverMigration = read(
    'supabase/migrations/20260818030000_character_authored_document_reference_cutover.sql'
  )

  it.each([
    ['canonical character tables', characterTables],
    ['generated bootstrap bundle', generatedBundle],
    ['bootstrap migration', bootstrapMigration]
  ])('keeps %s on the structured character state schema', (_label, sql) => {
    expect(sql).toMatch(/inspiration boolean NOT NULL DEFAULT false/i)
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.character_note_groups')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.character_notes')
    expect(sql).toContain('character_notes_group_owner_fkey')
    expect(sql).toContain('character_equipment_container_owner_fkey')
    expect(sql).toContain('character_attuned_equipment_owner_fkey')
    expect(sql).toContain('character_currency_groups_container_owner_fkey')
    expect(sql).toContain('character_currencies_group_owner_fkey')
    expect(sql).not.toContain('build_state jsonb')
  })

  it('keeps the deployed migration safe for both old and bootstrap-built databases', () => {
    expect(playStateMigration).toContain('ADD COLUMN IF NOT EXISTS inspiration')
    expect(playStateMigration).toContain('DROP COLUMN IF EXISTS build_state')
    expect(playStateMigration).toContain("conname = 'character_equipment_container_id_fkey'")
    expect(playStateMigration).toContain('CREATE TABLE IF NOT EXISTS public.character_note_groups')
    expect(playStateMigration).toContain('CREATE TABLE IF NOT EXISTS public.character_notes')
    expect(playStateMigration).not.toContain(
      'TRUNCATE TABLE public.character_currencies, public.character_currency_groups'
    )
    expect(playStateMigration).toContain('UPDATE public.character_currencies currency')
    expect(playStateMigration).toContain('SET character_id = currency_group.character_id')
    expect(playStateMigration).toContain('ALTER COLUMN character_id SET NOT NULL')
  })

  it.each([
    ['canonical character tables', characterTables],
    ['generated bootstrap bundle', generatedBundle]
  ])('includes spell state in the %s class-spell identity', (_label, sql) => {
    expect(sql).toContain('PRIMARY KEY (character_id, class_id, spell_id, state)')
  })

  it.each([
    ['canonical character tables', characterTables],
    ['generated bootstrap bundle', generatedBundle]
  ])('stores the starting-gold dice formula as text in %s', (_label, sql) => {
    expect(sql).toContain('gold_option text')
    expect(sql).not.toContain('gold_option uuid')
  })

  it('migrates the starting-gold dice formula without discarding existing values', () => {
    expect(startingGoldFormulaMigration).toContain(
      'DROP CONSTRAINT IF EXISTS character_class_equipment_session_gold_option_fkey'
    )
    expect(startingGoldFormulaMigration).toContain(
      'ALTER COLUMN gold_option TYPE text USING gold_option::text'
    )
  })

  it('upgrades existing class-spell identities without rewriting spell selections', () => {
    expect(classSpellStateIdentityMigration).toContain(
      'DROP CONSTRAINT IF EXISTS character_class_spells_pkey'
    )
    expect(classSpellStateIdentityMigration).toContain(
      'PRIMARY KEY (character_id, class_id, spell_id, state)'
    )
  })

  it('keeps adjustment provenance as a note without category or label fields', () => {
    expect(characterAdjustmentTables).toContain('source_note text')
    expect(characterAdjustmentTables).not.toContain('source_category')
    expect(characterAdjustmentTables).not.toContain('source_label')
  })

  it.each([
    ['canonical character tables', characterTables],
    ['generated bootstrap bundle', generatedBundle]
  ])('stores creature origin and instance hit point state in %s', (_label, sql) => {
    expect(sql).toContain("origin_kind text NOT NULL DEFAULT 'WORLD'")
    expect(sql).toContain("relationship_kind IN ('MOUNT', 'COMPANION', 'OWNED')")
    expect(sql).toContain('current_hit_points INTEGER')
    expect(sql).toContain('temp_hit_points INTEGER')
    expect(sql).toContain('character_creatures_hit_points_nonnegative_chk')
    expect(sql).toContain('character_vehicles_current_hit_points_nonnegative_chk')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.character_creature_hit_dice_state')
    expect(sql).toContain('character_creature_hit_dice_state_creature_owner_fkey')
  })

  it('migrates legacy summoned creatures to a companion role with summoned origin', () => {
    expect(creatureOriginMigration).toContain('ADD COLUMN IF NOT EXISTS origin_kind text')
    expect(creatureOriginMigration).toContain("WHEN relationship_kind = 'SUMMONED' THEN 'SUMMONED'")
    expect(creatureOriginMigration).toContain("SET relationship_kind = 'COMPANION'")
    expect(creatureOriginMigration).toContain("origin_kind IN ('WORLD', 'SUMMONED')")
    expect(creatureOriginMigration).toContain('character_creatures_hit_points_nonnegative_chk')
    expect(creatureOriginMigration).toContain(
      'character_vehicles_current_hit_points_nonnegative_chk'
    )
    expect(creatureOriginMigration).toContain('No direct browser API access')
  })

  it('migrates adjustment labels into capped notes before removing legacy provenance fields', () => {
    expect(adjustmentNoteOnlyMigration).toContain('SET source_note = CASE')
    expect(adjustmentNoteOnlyMigration).toContain('THEN left(btrim(source_label), 240)')
    expect(adjustmentNoteOnlyMigration).toMatch(
      /ELSE left\(btrim\(source_label\) \|\| .+ \|\| btrim\(source_note\), 240\)/
    )
    expect(adjustmentNoteOnlyMigration).toContain("table_name || '_source_category_chk'")
    expect(adjustmentNoteOnlyMigration).toContain("table_name || '_source_label_chk'")
    expect(adjustmentNoteOnlyMigration).toContain('DROP COLUMN IF EXISTS source_category')
    expect(adjustmentNoteOnlyMigration).toContain('DROP COLUMN IF EXISTS source_label')
  })

  it('keeps spell customizations and resource usage keyed by stable source identity', () => {
    expect(characterAdjustmentTables).toContain(
      'CREATE TABLE IF NOT EXISTS public.character_spell_customizations'
    )
    expect(characterAdjustmentTables).toContain('source_kind text NOT NULL')
    expect(characterAdjustmentTables).toContain('source_instance_id text NOT NULL')
    expect(characterAdjustmentTables).toContain(
      'UNIQUE (character_id, spell_id, source_kind, source_instance_id)'
    )
    expect(characterAdjustmentTables).toContain(
      'CREATE TABLE IF NOT EXISTS public.character_sheet_resource_usage'
    )
    expect(characterAdjustmentTables).toContain("owner_kind = 'SPELL_SOURCE'")
    expect(characterAdjustmentTables).toContain("owner_kind = 'AUTHORED_SOURCE'")
    expect(characterAdjustmentTables).toContain('source_id text')
    expect(characterAdjustmentTables).toContain(
      'ON public.character_sheet_resource_usage (character_id, source_id, charge_id)'
    )
    expect(characterAdjustmentTables).toContain('source_kind IN (')
    expect(characterAdjustmentTables).toContain('AND source_instance_id IS NOT NULL')
    expect(characterAdjustmentTables).toContain(
      'character_id, resource_grant_id, spell_id, source_kind, source_instance_id'
    )
  })

  it('stores nested authored identifiers without foreign keys to retired detail tables', () => {
    for (const reference of [
      'REFERENCES public.race_ancestries',
      'REFERENCES public.race_ancestry_options',
      'REFERENCES public.class_specializations',
      'REFERENCES public.class_resources',
      'REFERENCES public.starting_equipment_groups',
      'REFERENCES public.starting_equipment_options',
      'REFERENCES public.starting_equipment_option_items',
      'REFERENCES public.features',
      'REFERENCES public.options'
    ]) {
      expect(characterTables).not.toContain(reference)
    }
    expect(characterAdjustmentTables).not.toContain('REFERENCES public.charges')
    expect(characterAdjustmentTables).not.toContain('REFERENCES public.features')
    expect(authoredDocumentReferenceCutoverMigration).toContain(
      'character_ancestry_acquisitions_ancestry_id_fkey'
    )
    expect(authoredDocumentReferenceCutoverMigration).toContain(
      'character_sheet_resource_usage_charge_id_fkey'
    )
  })
})
