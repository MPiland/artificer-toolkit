import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSql } from './helpers/normalize-sql.js'

const read = (path: string) => normalizeSql(readFileSync(join(process.cwd(), path), 'utf8'))
const canonical = read('packages/db/src/domains/rules/tables/rules_catalogues.sql')
const migration = read(
  'supabase/migrations/20260825060000_rules_catalogues_and_reusable_definitions.sql'
)

describe('rules catalogue and reusable definition schema', () => {
  it.each([canonical, migration])(
    'enforces source/system integrity and server-only access',
    (source) => {
      expect(source).toContain('rules_catalogues')
      expect(source).toContain('content_sources')
      expect(source).toContain('rules_catalogue_content_sources')
      expect(source).toContain('reusable_definitions')
      expect(source).toContain('reusable_definition_drafts')
      expect(source).toContain('FOREIGN KEY (catalogue_id, game_system_id)')
      expect(source).toContain('FOREIGN KEY (content_source_id, game_system_id)')
      expect(source).toContain("kind IN ('PLATFORM', 'USER')")
      expect(source).toContain('FORCE ROW LEVEL SECURITY')
      expect(source).toContain(
        'REVOKE ALL ON TABLE public.reusable_definitions FROM anon, authenticated'
      )
    }
  )

  it('keeps one current tuple and one editable draft per root', () => {
    expect(canonical).toContain('current_document IS NULL AND current_checksum IS NULL')
    expect(canonical).toContain('current_document IS NOT NULL AND current_checksum IS NOT NULL')
    expect(canonical).toContain('current_contract_version IS NOT NULL AND published_at IS NOT NULL')
    expect(canonical).toContain('definition_id uuid PRIMARY KEY')
    expect(canonical).toContain('base_definition_version INTEGER NOT NULL')
  })
})
