import { describe, expect, it } from 'vitest'

import { environmentalZones } from '@artificer-toolkit/rules-runtime/testing/authoredZoneFixture'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createNodeRuntimeSourceReader } from './systemSourceRows.js'

/**
 * MOVE-3.2 (ADR 0038): the GM zone tool renders the zone node map an author's item or spell
 * outcome uses, so a pit or a caltrop field the GM builds there passes through it exactly as
 * authored. The room test `nativeRoomEnvironmentalZone.test.ts` proves the zones then resolve as
 * an item's do.
 */

const reader = createNodeRuntimeSourceReader({
  coreCodes: dnd5eCoreCodeAdapter.lists,
  system: srdSystemRecord,
  readAuthoredRows: () => [],
  readReusableDefinitions: async () => []
})

describe('an environmental zone through the zone node map', () => {
  it.each(Object.entries(environmentalZones()))(
    'keeps the GM-built %s exactly as authored',
    async (_name, zone) => {
      const result = await normalizeNodeRuntimeValues(reader, {
        mapId: 'outcome',
        systemId: srdSystemRecord.id,
        values: structuredClone(zone) as unknown as Record<string, unknown>
      })

      expect(result.clearedPaths).toEqual([])
      expect(result.values).toEqual(zone)
    }
  )
})
