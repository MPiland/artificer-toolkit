import { describe, expect, it } from 'vitest'
import {
  SOURCE_IMPORT_BATCH_COST_BUDGET,
  sourceImportBatches,
  sourceImportRecordCost
} from './importBatches'

const batchCost = (batch: readonly unknown[]) =>
  batch.reduce<number>((sum, record) => sum + sourceImportRecordCost(record), 0)

describe('source import CPU-budgeted batches', () => {
  it('preserves order and every record, and yields nothing for no records', () => {
    const records = Array.from({ length: 237 }, (_, id) => ({ id }))
    const batches = [...sourceImportBatches(records)]
    expect(batches.flat()).toEqual(records)
    expect([...sourceImportBatches([])]).toEqual([])
  })

  it('packs records to the cost budget without exceeding it or leaving a batch under-filled', () => {
    const records = Array.from({ length: 237 }, (_, id) => ({ id, value: 'a'.repeat(id % 7 << 10) }))
    const batches = [...sourceImportBatches(records)]
    expect(batches.length).toBeGreaterThan(1)
    expect(batches.flat()).toEqual(records)
    for (const [index, batch] of batches.entries()) {
      expect(batchCost(batch)).toBeLessThanOrEqual(SOURCE_IMPORT_BATCH_COST_BUDGET)
      const next = batches[index + 1]?.[0]
      if (next !== undefined)
        expect(batchCost(batch) + sourceImportRecordCost(next)).toBeGreaterThan(
          SOURCE_IMPORT_BATCH_COST_BUDGET
        )
    }
  })

  it('isolates a record costing more than the budget without truncating it', () => {
    const large = { id: 'large', value: 'a'.repeat(SOURCE_IMPORT_BATCH_COST_BUDGET * 1024) }
    const records = [{ id: 1 }, large, { id: 2 }]
    const batches = [...sourceImportBatches(records)]
    expect(batches).toEqual([[{ id: 1 }], [large], [{ id: 2 }]])
  })

  it('weights by UTF-8 bytes', () => {
    expect(sourceImportRecordCost({ value: 'é'.repeat(4096) })).toBeGreaterThan(
      sourceImportRecordCost({ value: 'a'.repeat(4096) })
    )
  })

  it('isolates every Class record, however small, for parent-document validation cost', () => {
    const records = [
      { id: 1, subjectKind: 'SPELL' },
      { id: 2, subjectKind: 'CLASS' },
      { id: 3, subjectKind: 'CLASS' },
      { id: 4, subjectKind: 'SPELL' }
    ]
    expect([...sourceImportBatches(records)]).toEqual([
      [records[0]],
      [records[1]],
      [records[2]],
      [records[3]]
    ])
  })
})
