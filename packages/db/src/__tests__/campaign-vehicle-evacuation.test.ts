import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(import.meta.dirname, '../repositories/campaignVehicleEvacuation.ts'),
  'utf8'
)

describe('Campaign Vehicle evacuation repository', () => {
  it('locks owners and their item, group, and balance graph deterministically', () => {
    const lockStart = source.indexOf('async lockOwners(')
    const graphStart = source.indexOf('async lockOwnerGraphs(', lockStart)
    const evacuateStart = source.indexOf('async evacuate(', graphStart)
    const lockMethod = source.slice(lockStart, graphStart)
    const graphMethod = source.slice(graphStart, evacuateStart)

    expect(lockMethod).toContain(".orderBy('id', 'asc')")
    expect(lockMethod).toContain('.forUpdate()')
    expect(graphMethod).toContain('set constraints all deferred')
    expect(graphMethod).toContain('inventory_items')
    expect(graphMethod).toContain('inventory_currency_groups')
    expect(graphMethod).toContain('inventory_currency_balances')
    expect(graphMethod.match(/order by id for update/g)).toHaveLength(3)
  })

  it('preserves item identity/nesting and clears only direct Vehicle placement', () => {
    expect(source).toContain('update public.inventory_items')
    expect(source).toContain('set owner_id = ${input.destinationOwnerId}::uuid')
    expect(source).not.toContain('set container_id = null')
    expect(source).toContain("placement_kind = 'VEHICLE'")
    expect(source).toContain('placement_id = ${input.vehicleId}::uuid')
  })

  it('keeps explicit group and balance IDs while merging only ungrouped denominations', () => {
    expect(source).toContain('and group_id is null')
    expect(source).toContain('set amount = amount +')
    expect(source).toContain('.set({ group_id: null')
    expect(source).toContain('set owner_id = ${input.destinationOwnerId}::uuid,')
    expect(source).toContain('group_id = ${group.id}::uuid')
    expect(source).not.toContain('insert into public.inventory_currency_groups')
  })

  it('verifies the source owner is empty before version advancement and Vehicle deletion', () => {
    const emptyCheck = source.indexOf('Vehicle inventory owner')
    const versionAdvance = source.indexOf(".updateTable('inventory_owners')", emptyCheck)
    const vehicleDelete = source.indexOf(".deleteFrom('campaign_vehicles')", versionAdvance)

    expect(emptyCheck).toBeGreaterThan(-1)
    expect(versionAdvance).toBeGreaterThan(emptyCheck)
    expect(vehicleDelete).toBeGreaterThan(versionAdvance)
  })
})
