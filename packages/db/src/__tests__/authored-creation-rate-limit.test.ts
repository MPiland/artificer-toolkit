import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('authored creation rate-limit schema', () => {
  const sources = [
    read('packages/db/src/domains/subjects/tables/authored_definitions.sql'),
    read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'),
    read('supabase/migrations/20260802040515_add_authored_creation_rate_limits.sql')
  ]
  const migration = sources[2]

  it('keeps one private account counter with fixed minute and hour ceilings', () => {
    for (const source of sources) {
      expect(source).toMatch(
        /CREATE TABLE(?: IF NOT EXISTS)? public\.authored_definition_creation_rate_limits/
      )
      expect(source).toContain(
        'ALTER TABLE public.authored_definition_creation_rate_limits ENABLE ROW LEVEL SECURITY'
      )
      expect(source).toContain('minute_count BETWEEN 0 AND 10')
      expect(source).toContain('hour_count BETWEEN 0 AND 100')
      expect(source).toContain('FROM anon, authenticated')
    }

    expect(migration).not.toContain('CREATE POLICY')
    expect(migration).not.toContain('GRANT')
    expect(sources[1]).toContain("c.relname <> 'authored_definition_creation_rate_limits'")
  })
})
