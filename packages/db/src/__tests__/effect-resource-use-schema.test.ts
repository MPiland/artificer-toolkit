import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('effect invocation resource-use persistence schema', () => {
  it.each([
    ['canonical table', read('packages/db/src/domains/effects/tables/invocations.sql')],
    [
      'generated bootstrap bundle',
      read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql')
    ]
  ])(
    'defines the %s owned resource reference and paired positive cost constraint',
    (_label, sql) => {
      expect(sql).toContain(
        'resource_charge_id uuid REFERENCES public.charges (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED'
      )
      expect(sql).toContain('resource_cost integer')
      expect(sql).toContain('effect_invocations_resource_use_pair_check')
      expect(sql).toContain('resource_charge_id IS NULL AND resource_cost IS NULL')
      expect(sql).toContain('resource_charge_id IS NOT NULL AND resource_cost > 0')
    }
  )

  it('migrates the initially restricted reference to owned-row cascade semantics', () => {
    const initial = read('supabase/migrations/20260814020000_effect_invocation_resource_use.sql')
    const cascade = read(
      'supabase/migrations/20260814040000_effect_invocation_resource_charge_cascade.sql'
    )

    expect(initial).toContain('ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED')
    expect(cascade).toContain('DROP CONSTRAINT effect_invocations_resource_charge_id_fkey')
    expect(cascade).toContain('ON DELETE CASCADE')
    expect(cascade).toContain('DEFERRABLE INITIALLY DEFERRED')
  })
})
