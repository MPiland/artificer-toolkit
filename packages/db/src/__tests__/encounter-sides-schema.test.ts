import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const root = process.cwd().endsWith('packages\\db')
  ? join(process.cwd(), '..', '..')
  : process.cwd()

const sources = [
  join(root, 'packages/db/src/domains/encounters/tables/encounters.sql'),
  join(root, 'supabase/migrations/20260828010000_encounter_actor_sides.sql')
].map((path) => normalizeSql(readFileSync(path, 'utf8')))

describe('Encounter side persistence', () => {
  it.each(sources)('keeps UUID side identity and closed symmetric relationships', (source) => {
    expect(source).toContain('CREATE TABLE')
    expect(source).toContain('encounter_sides')
    expect(source).toContain('encounter_side_relationships')
    expect(source).toContain("relationship_kind IN ('ALLIED', 'NEUTRAL', 'HOSTILE')")
    expect(source).toContain('CHECK (first_side_id::text < second_side_id::text)')
    expect(source).toContain('FOREIGN KEY (side_id, encounter_id)')
    expect(source).toContain('REFERENCES public.encounter_sides (id, encounter_id)')
    expect(source).toContain('FORCE ROW LEVEL SECURITY')
    expect(source).toContain('REVOKE ALL ON TABLE public.encounter_sides FROM anon, authenticated')
    expect(source).toContain(
      'REVOKE ALL ON TABLE public.encounter_side_relationships FROM anon, authenticated'
    )
  })
})
