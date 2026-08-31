import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const read = (path: string) => normalizeSql(readFileSync(join(process.cwd(), path), 'utf8'))
const systems = read('packages/db/src/domains/subjects/tables/systems.sql')
const catalogues = read('packages/db/src/domains/rules/tables/rules_catalogues.sql')
const modifiers = read('packages/db/src/domains/grants/tables/modifiers.sql')
const migration = read('supabase/migrations/20260827010000_character_pinned_sense_definitions.sql')

describe('sense definition and modifier persistence', () => {
  it('binds sense catalogue and reusable definition identity by the same System-scoped UUID', () => {
    expect(systems).toContain('senses_id_system_key UNIQUE (id, system_id)')
    expect(catalogues).toContain('FOREIGN KEY (id, system_id)')
    expect(catalogues).toContain('REFERENCES public.reusable_definitions (id, game_system_id)')
    expect(catalogues).toContain('ON DELETE RESTRICT')
    expect(catalogues).toContain('DEFERRABLE INITIALLY DEFERRED')
  })

  it('stores SENSE_RANGE through same-System UUID references only', () => {
    expect(modifiers).toContain('system_id uuid NOT NULL')
    expect(modifiers).toContain('sense_definition_id uuid')
    expect(modifiers).not.toContain('sense_code text')
    expect(modifiers).toContain('REFERENCES public.modifier_grants (id, system_id)')
    expect(modifiers).toContain('REFERENCES public.senses (id, system_id)')
    expect(modifiers).toContain(
      "value_domain_code = 'SENSE_RANGE' AND sense_definition_id IS NOT NULL"
    )
  })

  it('converts old text selectors only through exact same-System vocabulary identity', () => {
    expect(migration).toMatch(/SET\s+system_id\s*=\s*grants\.system_id/)
    expect(migration).toContain('senses.system_id = grants.system_id')
    expect(migration).toContain('senses.code = params.sense_code')
    expect(migration).toContain('sense_code has no exact same-System sense definition')
    expect(migration).toContain('DROP COLUMN sense_code')
    expect(migration).toContain('senses_reusable_definition_identity_fkey')
    expect(migration).toContain('NOT VALID')
  })

  it('backfills authoritative Scene environment state and recomputes the versioned projection checksum', () => {
    expect(migration).toContain('scene_environment_backfill')
    expect(migration).toContain('scene_delta_environment_backfill')
    expect(migration).toContain("'{ambientIllumination}'")
    expect(migration).toContain("'{darknessZones}'")
    expect(migration).toContain("WHEN 'DARKNESS_UPSERTED'")
    expect(migration).toContain('projection_schema_version = 2')
    expect(migration).toMatch(/'sceneId',\s*scene\.id::text/)
    expect(migration).toMatch(/'projection',\s*normalized\.projection/)
    expect(migration).toContain('scene_projection_canonical_json')
    expect(migration).not.toContain("'{projection,ambientIllumination}'")
  })
})
