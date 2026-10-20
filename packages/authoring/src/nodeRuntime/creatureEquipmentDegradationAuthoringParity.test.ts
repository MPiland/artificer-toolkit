import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { blackPudding } from '@artificer-toolkit/source-data/srd/creatures/black-pudding.js'
import { rustMonster } from '@artificer-toolkit/source-data/srd/creatures/rust-monster.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-33 T6i: the Black Pudding's Dissolving Pseudopod and the Rust Monster's Antennae author the
 * generic `degradeEquipment` option a Builder author has on a creature feature, so each must pass
 * the creature node map exactly as authored, as must a variant with other destruction thresholds.
 */

const reader = createSrdNodeRuntimeReader()

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

function degradeOutcomes(creature: CreatureAuthored, label: string) {
  const outcomes = (creature.features ?? [])
    .flatMap((feature) => feature.effects ?? [])
    .flatMap((effect) => effect.paths)
    .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
    .filter((outcome) => outcome.effectKind === 'DEGRADE_EQUIPMENT')
  if (outcomes.length === 0) throw new Error(`${label} must author degradeEquipment outcomes.`)
  return outcomes
}

describe.each([
  ['Black Pudding', blackPudding, 1],
  ['Rust Monster', rustMonster, 3]
])(
  '%s equipment corrosion through the creature node map (SPELLS-33 T6i)',
  (label, creature, count) => {
    it('keeps the corrosion exactly as authored, with no closed rule for it', async () => {
      expect(JSON.stringify(creature)).not.toMatch(/DISSOLVING_PSEUDOPOD|RUST_MONSTER_ANTENNAE/)
      expect(degradeOutcomes(creature, label)).toHaveLength(count)
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    })

    it('keeps other destruction thresholds and steps the same way', async () => {
      const authored = structuredClone(creature)
      for (const outcome of degradeOutcomes(authored, label)) {
        outcome.step = 2
        outcome.destroyWhen.value += 1
      }
      const result = await normalize(authored)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
    })
  }
)
