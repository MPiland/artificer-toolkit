import { describe, expect, it } from 'vitest'
import { sourceImportBatches } from './importBatches'

describe('source import CPU-sized batches', () => {
  it('preserves order and every record while enforcing the ten-record ceiling', () => {
    const records = Array.from({ length: 23 }, (_, id) => ({ id }))
    const batches = [...sourceImportBatches(records)]
    expect(batches.map((batch) => batch.length)).toEqual([10, 10, 3])
    expect(batches.flat()).toEqual(records)
    expect([...sourceImportBatches([])]).toEqual([])
  })

  it('isolates large documents without truncation and counts UTF-8 bytes', () => {
    const records = [
      { id: 1, value: 'a'.repeat(110 * 1024) },
      { id: 2, value: 'a'.repeat(110 * 1024) },
      { id: 3, value: 'é'.repeat(40 * 1024) },
      { id: 4, value: 'é'.repeat(40 * 1024) },
      { id: 5, value: 'a'.repeat(150 * 1024) }
    ]
    const batches = [...sourceImportBatches(records)]
    expect(batches.map((batch) => batch.length)).toEqual([1, 1, 1, 1, 1])
    expect(batches.flat()).toEqual(records)
  })

  it('isolates Class records for relationship-validation CPU bounds', () => {
    const records = [
      { id: 1, subjectKind: 'SPELL' },
      { id: 2, subjectKind: 'SPELL' },
      { id: 3, subjectKind: 'CLASS' },
      { id: 4, subjectKind: 'CLASS' },
      { id: 5, subjectKind: 'SPELL' },
      { id: 6, subjectKind: 'SPELL' }
    ]
    const batches = [...sourceImportBatches(records)]
    expect(batches.map((batch) => batch.length)).toEqual([2, 1, 1, 2])
    expect(batches.flat()).toEqual(records)
  })
})
