import { describe, expect, it } from 'vitest'

import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import { mageArmor } from '@artificer-toolkit/source-data/srd/spells/mage-armor.js'
import { mindBlank } from '@artificer-toolkit/source-data/srd/spells/mind-blank.js'
import { passWithoutTrace } from '@artificer-toolkit/source-data/srd/spells/pass-without-trace.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

const reader = createSrdNodeRuntimeReader()

/** D156 T2a3: spells converted from closed rules to existing core options (ADR 0038 parity). */
describe('spells authored from core options through the effect node map (SPELLS-4.T2a3)', () => {
  it.each([
    ['Light', light],
    ['Mage Armor', mageArmor],
    ['Mind Blank', mindBlank],
    ['Pass without Trace', passWithoutTrace]
  ])('keeps the SRD %s effect exactly as authored', async (_name, spell) => {
    const authored = { ...structuredClone(caltropsBagOf20), effects: spell.effects }
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'equipment',
      systemId: srdSystemRecord.id,
      values: structuredClone(authored) as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
