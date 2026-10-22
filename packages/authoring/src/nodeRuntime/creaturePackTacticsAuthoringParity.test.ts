import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { giantRat } from '@artificer-toolkit/source-data/srd/creatures/giant-rat.js'
import { giantVulture } from '@artificer-toolkit/source-data/srd/creatures/giant-vulture.js'
import { hellHound } from '@artificer-toolkit/source-data/srd/creatures/hell-hound.js'
import { thug } from '@artificer-toolkit/source-data/srd/creatures/thug.js'
import { tribalWarrior } from '@artificer-toolkit/source-data/srd/creatures/tribal-warrior.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6d3a (D156): Pack Tactics is a standing attack roll advantage gated by an
 * enemy-near-target equipment condition, the same options a Builder author has on a creature
 * feature, so it must pass the creature node map exactly as authored, as must a variant with
 * another distance.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

const packTacticsCreatures = [giantRat, giantVulture, hellHound, thug, tribalWarrior]

describe('a creature’s Pack Tactics through the creature node map (SPELLS-33 T6d3a)', () => {
  it.each(packTacticsCreatures.map((creature) => [creature.label, creature] as const))(
    'keeps %s’s Pack Tactics exactly as authored, with no closed rule',
    async (_label, creature) => {
      const feature = creature.features?.find(({ label }) => label === 'Pack Tactics')
      expect(feature?.grants?.modifiers).toHaveLength(4)
      expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it('keeps Pack Tactics with another distance the same way', async () => {
    const authored = structuredClone(giantRat)
    const grants = authored.features?.find(({ label }) => label === 'Pack Tactics')?.grants
    if (!grants?.modifiers) throw new Error('The Giant Rat must author Pack Tactics grants.')
    for (const grant of grants.modifiers) {
      const condition = grant.restrictions?.groups?.[0]?.contexts?.[0]?.conditions?.[0]
      if (condition?.kind !== 'PREDICATE' || condition.predicateCode !== 'ENEMY_NEAR_TARGET')
        throw new Error('Pack Tactics must author an enemy-near-target condition.')
      condition.feet = 10
    }
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
