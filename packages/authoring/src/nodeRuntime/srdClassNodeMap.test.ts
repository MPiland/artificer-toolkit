import { describe, expect, it } from 'vitest'

import { srdClasses } from '@artificer-toolkit/source-data/srd/classes/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T3d: an owned copy of any SRD class saves unchanged, so every SRD class record must
 * pass the class node map exactly as authored, equipment proficiency eligibility included.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

describe('SRD classes through the class node map (SPELLS-31.T3d)', () => {
  it.each(srdClasses.map((record) => ({ label: record.label, record })))(
    'keeps the SRD $label exactly as authored',
    async ({ record }) => {
      const values = structuredClone(record) as unknown as Record<string, unknown>
      const result = await normalizeNodeRuntimeValues(reader, {
        mapId: 'class',
        systemId: srdSystemRecord.id,
        values
      })
      expect(result.clearedPaths).toEqual([])
      expect(result.values).toEqual(record)
    }
  )
})

/**
 * SPELLS-31.T5m (D187a): Blindsense, Feral Senses and Witch Sight are rare awareness senses, so they
 * ship as their description (a GM ruling) with no closed rule kind behind them.
 */
const findFeatures = (node: unknown, label: string): Record<string, unknown>[] => {
  if (Array.isArray(node)) return node.flatMap((item) => findFeatures(item, label))
  if (node === null || typeof node !== 'object') return []
  const record = node as Record<string, unknown>
  const own = record.label === label && typeof record.description === 'string' ? [record] : []
  return [...own, ...Object.values(record).flatMap((value) => findFeatures(value, label))]
}

describe('awareness senses ship as descriptions (SPELLS-31.T5m)', () => {
  it.each([
    { className: 'Rogue', label: 'Blindsense' },
    { className: 'Ranger', label: 'Feral Senses' },
    { className: 'Warlock', label: 'Witch Sight' }
  ])('keeps $label as description-only and saves it unchanged', async ({ className, label }) => {
    const record = srdClasses.find((candidate) => candidate.label === className)
    expect(record).toBeDefined()
    const features = findFeatures(record, label)
    expect(features).toHaveLength(1)
    expect(features[0]?.effects).toBeUndefined()
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'class',
      systemId: srdSystemRecord.id,
      values: structuredClone(record) as unknown as Record<string, unknown>
    })
    expect(findFeatures(result.values, label)).toEqual(features)
  })
})
