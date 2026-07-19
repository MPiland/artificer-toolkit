import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('character play-state persistence schema', () => {
  const characterTables = read('packages/db/src/domains/subjects/tables/characters.sql')
  const generatedBundle = read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql')
  const bootstrapMigration = read('supabase/migrations/20260316000100_bootstrap_bundle.sql')
  const playStateMigration = read('supabase/migrations/20260713090000_character_play_state_persistence.sql')
  const classSpellStateIdentityMigration = read('supabase/migrations/20260714053000_character_class_spell_state_identity.sql')

  it.each([
    ['canonical character tables', characterTables],
    ['generated bootstrap bundle', generatedBundle],
    ['bootstrap migration', bootstrapMigration]
  ])('keeps %s on the structured character state schema', (_label, sql) => {
    expect(sql).toContain('inspiration boolean NOT NULL DEFAULT false')
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
  })

  it.each([
    ['canonical character tables', characterTables],
    ['generated bootstrap bundle', generatedBundle]
  ])('includes spell state in the %s class-spell identity', (_label, sql) => {
    expect(sql).toContain('PRIMARY KEY (character_id, class_id, spell_id, state)')
  })

  it('upgrades existing class-spell identities without rewriting spell selections', () => {
    expect(classSpellStateIdentityMigration).toContain('DROP CONSTRAINT IF EXISTS character_class_spells_pkey')
    expect(classSpellStateIdentityMigration).toContain('PRIMARY KEY (character_id, class_id, spell_id, state)')
  })
})
