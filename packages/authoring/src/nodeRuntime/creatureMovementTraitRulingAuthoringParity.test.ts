import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { adultWhiteDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-white-dragon.js'
import { ancientWhiteDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-white-dragon.js'
import { blackPudding } from '@artificer-toolkit/source-data/srd/creatures/black-pudding.js'
import { bulette } from '@artificer-toolkit/source-data/srd/creatures/bulette.js'
import { drider } from '@artificer-toolkit/source-data/srd/creatures/drider.js'
import { giantFrog } from '@artificer-toolkit/source-data/srd/creatures/giant-frog.js'
import { giantToad } from '@artificer-toolkit/source-data/srd/creatures/giant-toad.js'
import { merrow } from '@artificer-toolkit/source-data/srd/creatures/merrow.js'
import { ochreJelly } from '@artificer-toolkit/source-data/srd/creatures/ochre-jelly.js'
import { roper } from '@artificer-toolkit/source-data/srd/creatures/roper.js'
import { vampire } from '@artificer-toolkit/source-data/srd/creatures/vampire.js'
import { vampireSpawn } from '@artificer-toolkit/source-data/srd/creatures/vampire-spawn.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T4o (D156, D187a): Spider Climb, standing leaps, Ice Walk and the Merrow's Harpoon pull
 * are GM rulings. There is no elevation, jump or terrain-type model, and the pull needs a Strength
 * contest and a size gate that no follow-up supports, so none is built. Each creature must pass its
 * node map exactly as authored, and the six closed rule kinds are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const CREATURES: [string, CreatureAuthored, string, string][] = [
  ['Adult White Dragon', adultWhiteDragon, 'Ice Walk', 'Ice Walk'],
  ['Ancient White Dragon', ancientWhiteDragon, 'Ice Walk', 'Ice Walk'],
  ['Black Pudding', blackPudding, 'Spider Climb', 'Spider Climb'],
  ['Drider', drider, 'Spider Climb', 'Spider Climb'],
  ['Ochre Jelly', ochreJelly, 'Spider Climb', 'Spider Climb'],
  ['Roper', roper, 'Spider Climb', 'Spider Climb'],
  ['Vampire', vampire, 'Spider Climb', 'Spider Climb'],
  ['Vampire Spawn', vampireSpawn, 'Spider Climb', 'Spider Climb'],
  ['Bulette', bulette, 'Standing Leap', 'Standing Leap'],
  ['Giant Frog', giantFrog, 'Standing Leap', 'Standing Leap'],
  ['Giant Toad', giantToad, 'Standing Leap', 'Standing Leap'],
  ['Merrow', merrow, 'Harpoon', 'Harpoon Pull']
]

describe('movement traits and the Harpoon pull as GM rulings (D187a)', () => {
  it.each(CREATURES)('%s authors %s as a ruling', (_name, creature, featureLabel, ruling) => {
    const outcomes = (creature.features ?? [])
      .filter((feature) => feature.label === featureLabel)
      .flatMap((feature) => feature.effects ?? [])
      .flatMap((effect) => effect.paths ?? [])
      .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
      .filter((outcome) => outcome.effectKind === 'MANUAL_ADJUDICATION')
    expect(outcomes.length).toBeGreaterThan(0)
    for (const outcome of outcomes) expect(outcome).toMatchObject({ label: ruling })
  })

  it.each(CREATURES)(
    'keeps %s exactly as authored through the creature node map',
    async (_name, creature) => {
      const result = await normalizeNodeRuntimeValues(reader, {
        mapId: 'creature',
        systemId: srdSystemRecord.id,
        values: structuredClone(creature) as unknown as Record<string, unknown>
      })
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it('no longer lists the six closed rule kinds', () => {
    for (const kind of [
      'CREATURE_GIANT_FROG_STANDING_LEAP',
      'CREATURE_GIANT_TOAD_STANDING_LEAP',
      'CREATURE_ICE_WALK',
      'CREATURE_MERROW_HARPOON',
      'CREATURE_SPIDER_CLIMB',
      'CREATURE_STANDING_LEAP'
    ])
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
  })
})
