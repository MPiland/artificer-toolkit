import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { assassin } from '@artificer-toolkit/source-data/srd/creatures/assassin.js'
import { bugbear } from '@artificer-toolkit/source-data/srd/creatures/bugbear.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6d3b (D156, D165): Assassinate is a standing attack roll advantage gated by a
 * target-has-not-taken-a-turn equipment condition, the same options a Builder author has on a
 * creature feature, so it must pass the creature node map exactly as authored, as must the
 * excluded variant. The Bugbear's Surprise Attack is a description with no mechanic.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

describe('a creature Assassinate through the creature node map (SPELLS-33 T6d3b)', () => {
  it('keeps the Assassin Assassinate exactly as authored, with no closed rule', async () => {
    const feature = assassin.features?.find(({ label }) => label === 'Assassinate')
    expect(feature?.grants?.modifiers).toHaveLength(4)
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    expect(JSON.stringify(feature)).toContain('TARGET_HAS_NOT_TAKEN_TURN')
    const result = await normalize(assassin)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(assassin.features)
  })

  it('keeps Assassinate with the condition excluded the same way', async () => {
    const authored = structuredClone(assassin)
    const grants = authored.features?.find(({ label }) => label === 'Assassinate')?.grants
    if (!grants?.modifiers) throw new Error('The Assassin must author Assassinate grants.')
    for (const grant of grants.modifiers) {
      const condition = grant.restrictions?.groups?.[0]?.contexts?.[0]?.conditions?.[0]
      if (
        condition?.kind !== 'PREDICATE' ||
        condition.predicateCode !== 'TARGET_HAS_NOT_TAKEN_TURN'
      )
        throw new Error('Assassinate must author a target-has-not-taken-a-turn condition.')
      condition.constraint = 'EXCLUDE'
    }
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  it('keeps the Bugbear description-only Surprise Attack exactly as authored', async () => {
    const feature = bugbear.features?.find(({ label }) => label === 'Surprise Attack')
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    const result = await normalize(bugbear)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(bugbear.features)
  })
})
