import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eVocabularyCapabilityAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/vocabulary'

/**
 * SPELLS-33.T7b (D156): a direct saving throw's failed result may carry a failure margin rider
 * ("fails by 5 or more, also paralyzed"), a core option the effect node map keeps exactly as
 * authored (ADR 0038). The Mummy and Mummy Lord Dreadful Glare author it in place of their closed
 * rules.
 */

const reader = createSrdNodeRuntimeReader(dnd5eVocabularyCapabilityAdapter.lists)

function normalize(mapId: 'equipment' | 'creature', values: unknown) {
  return normalizeNodeRuntimeValues(reader, {
    mapId,
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as Record<string, unknown>
  })
}

const GLARES = ['Mummy', 'Mummy Lord'].map((label) => {
  const record = srdCreatureRecords.find((creature) => creature.label === label)
  const index = record?.features.findIndex((feature) => feature.label === 'Dreadful Glare') ?? -1
  if (!record || index < 0) throw new Error(`${label} has no Dreadful Glare.`)
  return { creature: label, index, record }
})

describe('a failed save that also applies a condition when it failed by a margin (SPELLS-33.T7b, ADR 0038)', () => {
  it.each(GLARES)(
    'keeps the $creature’s Dreadful Glare exactly as authored',
    async ({ record, index }) => {
      const result = await normalize('creature', record)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features', index, 'effects'])).toEqual(
        record.features[index]?.effects
      )
    }
  )

  it('lets an author put the rider on any saving throw’s failure, so a homebrew hold builds what the glare does', async () => {
    const glare = GLARES[0]
    const failure = glare?.record.features[glare.index]?.effects?.[0]?.paths.find(
      ({ pathCode }) => pathCode === 'ON_SAVE_FAIL'
    )
    if (!failure) throw new Error('The glare has no failure path.')
    const effect = structuredClone(holdPerson.effects?.[0])
    if (!effect) throw new Error('Hold Person has no effect.')
    const authored = {
      ...structuredClone(caltropsBagOf20),
      effects: [
        {
          ...effect,
          paths: [
            ...effect.paths.filter(({ pathCode }) => pathCode !== 'ON_SAVE_FAIL'),
            structuredClone(failure)
          ]
        }
      ]
    } as EquipmentAuthored
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
