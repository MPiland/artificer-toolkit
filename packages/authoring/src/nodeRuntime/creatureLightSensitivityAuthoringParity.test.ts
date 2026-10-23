import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { cloaker } from '@artificer-toolkit/source-data/srd/creatures/cloaker.js'
import { drow } from '@artificer-toolkit/source-data/srd/creatures/drow.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6d1 (D189): Sunlight Sensitivity and Light Sensitivity are standing attack roll and
 * Wisdom check disadvantages gated by one holder-in-bright-light equipment condition, the same
 * options a Builder author has on a creature feature, so each must pass the creature node map
 * exactly as authored, as must the excluded variant.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

function lightConditions(creature: CreatureAuthored, label: string) {
  const grants = creature.features?.find((feature) => feature.label === label)?.grants
  if (!grants?.modifiers) throw new Error(`${label} must author grants.`)
  return grants.modifiers.map((grant) => {
    const condition = grant.restrictions?.groups?.[0]?.contexts?.[0]?.conditions?.[0]
    if (condition?.kind !== 'PREDICATE' || condition.predicateCode !== 'HOLDER_IN_BRIGHT_LIGHT')
      throw new Error(`${label} must author a holder-in-bright-light condition.`)
    return condition
  })
}

describe.each([
  { creature: drow, label: 'Sunlight Sensitivity', requiresDaylight: true },
  { creature: cloaker, label: 'Light Sensitivity', requiresDaylight: false }
])('a creature $label through the creature node map (SPELLS-33 T6d1)', (input) => {
  it('keeps the feature exactly as authored, with no closed rule', async () => {
    const feature = input.creature.features?.find(({ label }) => label === input.label)
    expect(feature?.grants?.modifiers).toHaveLength(5)
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    for (const condition of lightConditions(input.creature, input.label))
      expect(condition.requiresDaylight).toBe(input.requiresDaylight)
    const result = await normalize(input.creature)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(input.creature.features)
  })

  it('keeps the feature with the condition excluded and the daylight flag flipped', async () => {
    const authored = structuredClone(input.creature)
    for (const condition of lightConditions(authored, input.label)) {
      condition.constraint = 'EXCLUDE'
      condition.requiresDaylight = !input.requiresDaylight
    }
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
