import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('authored creation rate-limit schema', () => {
  const canonical = read('packages/db/src/domains/subjects/tables/authored_content.sql')
  const generatedBundle = read(
    'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'
  )
  const publicApiAccess = read('packages/db/src/domains/bootstrap/security/public_api_access.sql')
  const migration = read(
    'supabase/migrations/20260804203049_remove_authored_revisions_add_import_refs.sql'
  )

  it('keeps one private account counter with fixed minute and hour ceilings', () => {
    for (const source of [canonical, generatedBundle]) {
      expect(source).toMatch(
        /CREATE TABLE(?: IF NOT EXISTS)? public\.authored_creation_rate_limits/
      )
      expect(source).toContain(
        'ALTER TABLE public.authored_creation_rate_limits ENABLE ROW LEVEL SECURITY'
      )
      expect(source).toContain('minute_count BETWEEN 0 AND 25')
      expect(source).toContain('hour_count BETWEEN 0 AND 100')
      expect(source).toMatch(/FROM\s+anon,\s+authenticated/)
    }

    expect(migration).toContain('RENAME TO authored_creation_rate_limits')
    expect(migration).toContain('RENAME CONSTRAINT authored_definition_creation_rate_limits')
    expect(migration).toContain('minute_count BETWEEN 0 AND 25')
    expect(migration).not.toContain('ON public.authored_creation_rate_limits FOR')
    expect(migration).not.toContain('GRANT')
    expect(publicApiAccess).toContain("c.relname <> 'authored_creation_rate_limits'")
  })
})
