import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { lamia } from '@artificer-toolkit/source-data/srd/creatures/lamia.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-33 T4c: the Lamia's Intoxicating Touch is an ON_HIT apply-grant of core roll-mode
 * modifiers, the same options a Builder author has on a creature feature, so it must pass the
 * creature node map exactly as authored, as must a variant with another duration.
 */

const reader = createSrdNodeRuntimeReader()

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

function curseBlock(creature: CreatureAuthored) {
  const path = creature.features
    ?.find((feature) => feature.label === 'Intoxicating Touch')
    ?.effects?.[0]?.paths.find(({ pathCode }) => pathCode === 'ON_HIT')
  if (path?.selectionKind !== 'FIXED') throw new Error('The Lamia must author a fixed ON_HIT path.')
  return path.resultBlock
}

describe('a creature’s curse touch through the creature node map (SPELLS-33 T4c)', () => {
  it('keeps the Lamia’s Intoxicating Touch exactly as authored, with no closed rule', async () => {
    const feature = lamia.features?.find(({ label }) => label === 'Intoxicating Touch')
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    const result = await normalize(lamia)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(lamia.features)
  })

  it('keeps the curse with another duration the same way', async () => {
    const authored = structuredClone(lamia)
    const block = curseBlock(authored)
    if (!block.duration) throw new Error('The curse must author a duration.')
    block.duration.amount = 8
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
