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
