import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('Character Sheet inventory item integrity', () => {
  const bootstrap = read('packages/db/src/domains/utils/create_database.sql')
  const adjustmentTables = read(
    'packages/db/src/domains/subjects/tables/character_sheet_adjustments.sql'
  )
  const migration = read(
    'supabase/migrations/20260807180000_character_inventory_sheet_fk_cutover.sql'
  )

  it('creates inventory tables before Character Sheet item FKs in canonical bootstrap', () => {
    const campaignsInclude = bootstrap.indexOf("\\i :etl_root'/campaigns/tables/campaigns.sql'")
    const adjustmentsInclude = bootstrap.indexOf(
      "\\i :etl_root'/subjects/tables/character_sheet_adjustments.sql'"
    )
    expect(campaignsInclude).toBeLessThan(adjustmentsInclude)
    expect(adjustmentTables).toContain(
      'FOREIGN KEY (item_instance_id)\n    REFERENCES public.inventory_items (id)'
    )
    expect(adjustmentTables).not.toContain(
      'REFERENCES public.character_equipment (character_id, id)'
    )
  })

  it('accepts only items currently owned by the referenced Character', () => {
    expect(migration).toContain(
      'FOREIGN KEY (item_instance_id)\n  REFERENCES public.inventory_items (id)'
    )
    expect(migration).not.toContain('REFERENCES public.character_equipment')
    expect(migration).toContain("inventory_owner.kind = 'CHARACTER'")
    expect(migration).toContain('inventory_owner.character_id = NEW.character_id')
    expect(migration).toContain('FOR KEY SHARE OF item, inventory_owner')
    expect(migration).toContain('character_item_adjustments_inventory_owner')
    expect(migration).toContain('character_sheet_resource_usage_inventory_owner')
  })

  it('clears item-local Sheet state only when custody changes', () => {
    expect(migration).toContain('IF OLD.owner_id = NEW.owner_id THEN')
    expect(migration).toContain(
      'DELETE FROM public.character_item_adjustments\n    WHERE character_id = source_character_id\n      AND item_instance_id = OLD.id'
    )
    expect(migration).toContain(
      'DELETE FROM public.character_sheet_resource_usage\n    WHERE character_id = source_character_id\n      AND item_instance_id = OLD.id'
    )
    expect(migration).toContain(
      'AFTER UPDATE OF owner_id ON public.inventory_items'
    )
  })
})
