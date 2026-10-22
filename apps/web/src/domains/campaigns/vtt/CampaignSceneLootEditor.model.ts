import type { LootEntry, LootRange, LootTable } from '@artificer-toolkit/schema/api/lootTables'
import { findLootRangeRefusal } from '@artificer-toolkit/shared/vtt/lootTable'

export function createLootRange(existing: readonly LootRange[]): LootRange {
  const top = existing.reduce((highest, range) => Math.max(highest, range.max ?? range.min), 0)
  const min = existing.length === 0 ? 1 : top + 1
  return { id: crypto.randomUUID(), min, max: min, entries: [] }
}

export function createLootTable(): LootTable {
  return {
    id: crypto.randomUUID(),
    name: 'Loot table',
    ranges: [createLootRange([])]
  }
}

export function createLootEntry(kind: LootEntry['kind'], fallbackId: string): LootEntry {
  return kind === 'ITEM'
    ? { kind, itemId: fallbackId, quantity: 1 }
    : { kind, denominationId: fallbackId, amount: 1 }
}

/** The first refusal across the draft's tables, named by table, for display before saving. */
export function describeLootDraftRefusal(tables: readonly LootTable[]) {
  for (const table of tables) {
    const refusal = findLootRangeRefusal(table.ranges)
    if (refusal) return `${table.name}: ${refusal.message}`
  }
  return null
}
