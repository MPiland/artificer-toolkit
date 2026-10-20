import { describe, expect, it } from 'vitest'
import {
  effectiveInventory,
  effectiveItemIds,
  storeInventory
} from '../projections/characterPlayState.js'

const row = (id: string, quantity: number) => ({ id, equipmentId: `eq-${id}`, quantity })
const inventory = [row('a', 3), row('b', 1), row('c', 2)]

describe('single-use item usage over the stored inventory', () => {
  it('shows the stored quantity minus what was used and hides used-up rows', () => {
    expect(
      effectiveInventory(inventory, [
        { itemInstanceId: 'a', used: 1 },
        { itemInstanceId: 'b', used: 1 }
      ])
    ).toEqual([row('a', 2), row('c', 2)])
  })

  it('leaves the inventory unchanged when nothing was used', () => {
    expect(effectiveInventory(inventory, [])).toEqual(inventory)
  })

  it('stores an edit of the effective quantity as the edited quantity plus what was used', () => {
    const base = { inventory, itemUsage: [{ itemInstanceId: 'a', used: 2 }] }
    const edited = effectiveInventory(base.inventory, base.itemUsage).map((item) =>
      item.id === 'a' ? { ...item, quantity: 5 } : item
    )
    expect(storeInventory(edited, base.itemUsage, base).inventory[0]).toEqual(row('a', 7))
  })

  it('keeps a used-up row at its original position while the editor removes another row', () => {
    const base = { inventory, itemUsage: [{ itemInstanceId: 'b', used: 1 }] }
    const edited = effectiveInventory(base.inventory, base.itemUsage).filter(
      (item) => item.id !== 'a'
    )
    expect(storeInventory(edited, base.itemUsage, base).inventory).toEqual([
      row('b', 1),
      row('c', 2)
    ])
  })

  it('prunes the usage of a row the editor deleted', () => {
    const base = { inventory, itemUsage: [{ itemInstanceId: 'a', used: 1 }] }
    const edited = effectiveInventory(base.inventory, base.itemUsage).filter(
      (item) => item.id !== 'a'
    )
    expect(storeInventory(edited, base.itemUsage, base).itemUsage).toEqual([])
  })

  it('round-trips an unedited inventory', () => {
    const base = {
      inventory,
      itemUsage: [
        { itemInstanceId: 'a', used: 1 },
        { itemInstanceId: 'b', used: 1 }
      ]
    }
    expect(
      storeInventory(effectiveInventory(base.inventory, base.itemUsage), base.itemUsage, base)
    ).toEqual(base)
  })

  it('reports a used-up row as neither equipped nor attuned', () => {
    const effective = effectiveInventory(inventory, [{ itemInstanceId: 'b', used: 1 }])
    expect(effectiveItemIds(['a', 'b', 'c'], effective)).toEqual(['a', 'c'])
  })
})

describe('corrosion over the stored inventory', () => {
  const degradation = [{ itemInstanceId: 'a', penalty: 2 }]

  it('shows the penalty on the corroded row and leaves the others alone', () => {
    expect(effectiveInventory(inventory, [], degradation)).toEqual([
      { ...row('a', 3), degradation: 2 },
      row('b', 1),
      row('c', 2)
    ])
  })

  it('never stores a derived penalty on the row when an editor writes the inventory back', () => {
    const base = { inventory, itemUsage: [] }
    expect(
      storeInventory(effectiveInventory(inventory, [], degradation), [], base).inventory
    ).toEqual(inventory)
  })
})
