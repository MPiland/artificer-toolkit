import { SRD_CREATURE_STAT_BLOCKS } from '@artificer-toolkit/source-data/srd/creatures/stat-blocks.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { describe, expect, it } from 'vitest'

import { snapshotStatBlock } from '../encounterProjection.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

describe('SRD Creature armor class', () => {
  const creatures = srdBaselineContent.subjects.creatures

  it('covers every SRD Creature with a printed stat block', () => {
    expect(creatures.length).toBeGreaterThan(300)
    for (const creature of creatures) expect(SRD_CREATURE_STAT_BLOCKS.has(creature.id)).toBe(true)
  })

  it(
    'computes the printed armor class from natural armor and the worn loadout',
    { timeout: 30_000 },
    () => {
      const mismatches = creatures.flatMap((creature, index) => {
        const printed = SRD_CREATURE_STAT_BLOCKS.get(creature.id)?.armorClass
        const computed = snapshotStatBlock(
          srdCreatureActor({ id: testUuid(index + 1), creature })
        )?.armorClass
        return computed === printed
          ? []
          : [`${creature.label}: computed ${computed}, printed ${printed}`]
      })
      expect(mismatches).toEqual([])
    }
  )
})
