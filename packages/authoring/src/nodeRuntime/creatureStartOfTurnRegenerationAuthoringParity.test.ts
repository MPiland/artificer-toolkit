import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { oni } from '@artificer-toolkit/source-data/srd/creatures/oni.js'
import { shieldGuardian } from '@artificer-toolkit/source-data/srd/creatures/shield-guardian.js'
import { troll } from '@artificer-toolkit/source-data/srd/creatures/troll.js'
import { vampire } from '@artificer-toolkit/source-data/srd/creatures/vampire.js'
import { vampireSpawn } from '@artificer-toolkit/source-data/srd/creatures/vampire-spawn.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-33 T4i1a: the Oni's and Shield Guardian's Regeneration author the generic start-of-turn
 * trigger, the at-least hit-point gate and a fixed heal that a Builder author has on a creature
 * feature, so each must pass the creature node map exactly as authored, as must a variant.
 */

const reader = createSrdNodeRuntimeReader()

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

function regenerationBlocks(creature: CreatureAuthored) {
  const blocks = (creature.features ?? [])
    .filter((feature) => feature.label === 'Regeneration')
    .flatMap((feature) => feature.effects ?? [])
    .flatMap((effect) => effect.paths)
    .flatMap((path) => (path.selectionKind === 'FIXED' ? [path.resultBlock] : []))
  if (blocks.length !== 1) throw new Error('Regeneration must author one result block.')
  return blocks
}

describe.each([
  ['Oni', oni],
  ['Shield Guardian', shieldGuardian]
])('%s Regeneration through the creature node map (SPELLS-33 T4i1a)', (_label, creature) => {
  it('keeps the heal exactly as authored, with no closed rule for it', async () => {
    expect(JSON.stringify(creature)).not.toMatch(/ONI_REGENERATION|SHIELD_GUARDIAN_REGENERATION/)
    expect(regenerationBlocks(creature)).toMatchObject([
      {
        gate: { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 1 },
        outcomes: [{ effectKind: 'HEAL', valueKind: 'FIXED', amount: 10 }]
      }
    ])
    const result = await normalize(creature)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
  })

  it('keeps another heal amount and gate floor the same way', async () => {
    const authored = structuredClone(creature)
    for (const block of regenerationBlocks(authored)) {
      block.gate = { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 5 }
      for (const outcome of block.outcomes)
        if (outcome.effectKind === 'HEAL' && outcome.valueKind === 'FIXED' && 'amount' in outcome)
          outcome.amount = 20
    }
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})

describe.each([
  ['Vampire', vampire, 1],
  ['Vampire Spawn', vampireSpawn, 1],
  ['Troll', troll, 0]
])(
  '%s Regeneration suppression through the creature node map (SPELLS-33 T4i1b2)',
  (_label, creature, floor) => {
    it('keeps the suppressing damage types exactly as authored, with no closed rule for it', async () => {
      expect(JSON.stringify(creature)).not.toMatch(/VAMPIRE_REGENERATION/)
      const [block] = regenerationBlocks(creature)
      expect(block?.suppressedByDamageTypeIds?.length).toBeGreaterThan(0)
      expect(block?.gate?.amount ?? 0).toBe(floor)
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    })

    it('keeps another set of suppressing damage types the same way', async () => {
      const authored = structuredClone(creature)
      for (const block of regenerationBlocks(authored))
        block.suppressedByDamageTypeIds = srdSystemRecord.damageTypes
          .filter(({ code }) => code === 'COLD' || code === 'THUNDER')
          .map(({ id }) => id)
      const result = await normalize(authored)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
    })
  }
)
