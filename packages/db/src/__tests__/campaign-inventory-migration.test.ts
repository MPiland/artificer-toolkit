import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('Campaign inventory migration', () => {
  const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
  const generatedBootstrap = read(
    'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'
  )
  const migration = read('supabase/migrations/20260807024202_campaign_core.sql')

  it.each([
    ['canonical bootstrap', canonical],
    ['generated bootstrap', generatedBootstrap],
    ['Campaign core migration', migration]
  ])('rejects ambiguous legacy equipment placements before backfill in %s', (_label, sql) => {
    const preflightIndex = sql.indexOf('conflicting_placement_count bigint')
    const backfillIndex = sql.indexOf('INSERT INTO public.inventory_items')

    expect(preflightIndex).toBeGreaterThanOrEqual(0)
    expect(preflightIndex).toBeLessThan(backfillIndex)
    expect(sql).toContain('FROM public.character_creature_equipment AS creature_equipment')
    expect(sql).toContain('FROM public.character_vehicle_equipment AS vehicle_equipment')
    expect(sql).toContain('UNION ALL')
    expect(sql).toContain('HAVING count(*) > 1')
    expect(sql).toContain("ERRCODE = '23514'")
    expect(sql).toContain(
      'Reconcile the legacy assignments so each inventory item is assigned to at most one creature or vehicle'
    )
  })
})
