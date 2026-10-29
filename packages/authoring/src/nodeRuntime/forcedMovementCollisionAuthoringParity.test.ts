import { describe, expect, it } from 'vitest'

import type {
  CreatureAuthored,
  EquipmentAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { airElemental } from '@artificer-toolkit/source-data/srd/creatures/air-elemental.js'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T6k2b4 (D159): the Air Elemental's Whirlwind collision is the authored `collision` block on
 * its forced movement, so a creature feature and an item hold the same push exactly as authored, with
 * no closed rule.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function whirlwind() {
  const feature = airElemental.features?.find(({ label }) => label.startsWith('Whirlwind'))
  if (!feature?.effects?.length) throw new Error('Whirlwind must author its effects.')
  return feature
}

describe('the Air Elemental Whirlwind collision from the authored collision block', () => {
  it('authors the collision on the push, with no closed rule on the feature', () => {
    const feature = whirlwind()
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    expect(JSON.stringify(feature.effects)).toContain('"collision"')
  })

  it('keeps the SRD Creature exactly as authored', async () => {
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'creature',
      systemId: srdSystemRecord.id,
      values: structuredClone(airElemental) as unknown as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    const kept = getValueAtPath(result.values, ['features']) as CreatureAuthored['features']
    expect(kept?.find(({ id }) => id === whirlwind().id)).toEqual(whirlwind())
  })

  it('keeps the same effects on an item, as a custom feature authors them', async () => {
    const authored = {
      ...structuredClone(caltropsBagOf20),
      effects: structuredClone(whirlwind().effects)
    } as EquipmentAuthored
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'equipment',
      systemId: srdSystemRecord.id,
      values: structuredClone(authored) as unknown as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
