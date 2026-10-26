import { describe, expect, it } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import { standingWardFeature } from '@artificer-toolkit/rules-runtime/testing/standingWardFeature'
import type { PathLifecycleReturnsOn } from '@artificer-toolkit/shared/core'
import type { ClassAuthored, CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-31.2: a standing effect is an always-on grant whose lifecycle names its End On triggers
 * and the rest it returns on. A Builder author writes it from those core options alone, so it passes
 * the class and creature node maps exactly as authored.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const RETURNS_ON: readonly PathLifecycleReturnsOn[] = ['LONG_REST', 'SHORT_REST']

function normalize(mapId: 'class' | 'creature', record: ClassAuthored | CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId,
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

describe('a standing effect through the node maps (SPELLS-31.2)', () => {
  for (const returnsOn of RETURNS_ON) {
    it(`keeps a class feature’s effect that returns on ${returnsOn} exactly as authored`, async () => {
      const ward = standingWardFeature(returnsOn)
      expect(JSON.stringify(ward)).not.toContain('CLOSED_RULE')
      const authored: ClassAuthored = { ...monk, features: [...(monk.features ?? []), ward] }
      const result = await normalize('class', authored)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
    })

    it(`keeps a creature feature’s effect that returns on ${returnsOn} exactly as authored`, async () => {
      const { availableAtLevel: _level, ...ward } = standingWardFeature(returnsOn)
      const authored: CreatureAuthored = { ...wolf, features: [...(wolf.features ?? []), ward] }
      const result = await normalize('creature', authored)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
    })
  }
})
