import type {
  SceneLootEntry,
  SceneLootRange,
  SceneLootTable
} from '@artificer-toolkit/schema/api/sceneLootTables'
import { findLootRangeRefusal } from '@artificer-toolkit/shared/vtt/lootTable'

export function createLootRange(existing: readonly SceneLootRange[]): SceneLootRange {
  const top = existing.reduce((highest, range) => Math.max(highest, range.max ?? range.min), 0)
  const min = existing.length === 0 ? 1 : top + 1
  return { id: crypto.randomUUID(), min, max: min, entries: [] }
}

export function createLootTable(): SceneLootTable {
  return {
    id: crypto.randomUUID(),
    name: 'Loot table',
    ranges: [createLootRange([])]
  }
}

export function createLootEntry(kind: SceneLootEntry['kind'], fallbackId: string): SceneLootEntry {
  return kind === 'ITEM'
    ? { kind, itemId: fallbackId, quantity: 1 }
    : { kind, denominationId: fallbackId, amount: 1 }
}

/** The first refusal across the draft's tables, named by table, for display before saving. */
export function describeLootDraftRefusal(tables: readonly SceneLootTable[]) {
  for (const table of tables) {
    const refusal = findLootRangeRefusal(table.ranges)
    if (refusal) return `${table.name}: ${refusal.message}`
  }
  return null
}
