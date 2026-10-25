import { describe, expect, it } from 'vitest'

import type { CreatureAuthored, EffectAuthored } from '@artificer-toolkit/shared'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { clayGolem } from '@artificer-toolkit/source-data/srd/creatures/clay-golem.js'
import { duergar } from '@artificer-toolkit/source-data/srd/creatures/duergar.js'
import { fleshGolem } from '@artificer-toolkit/source-data/srd/creatures/flesh-golem.js'
import { ironGolem } from '@artificer-toolkit/source-data/srd/creatures/iron-golem.js'
import { mimic } from '@artificer-toolkit/source-data/srd/creatures/mimic.js'
import { stoneGolem } from '@artificer-toolkit/source-data/srd/creatures/stone-golem.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T4s3 (D156, D187a): Immutable Form, Duergar Enlarge and the Mimic Pseudopod's Adhesive
 * rider are GM rulings. Each creature must pass its node map exactly as authored, and the five
 * closed rule kinds are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const manualOutcomes = (effect: EffectAuthored | undefined) =>
  (effect?.paths ?? []).flatMap((path) =>
    path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
  )

const CREATURES: [string, CreatureAuthored, string, string][] = [
  ['Clay Golem', clayGolem, 'Immutable Form', 'PASSIVE'],
  ['Flesh Golem', fleshGolem, 'Immutable Form', 'PASSIVE'],
  ['Iron Golem', ironGolem, 'Immutable Form', 'PASSIVE'],
  ['Stone Golem', stoneGolem, 'Immutable Form', 'PASSIVE'],
  ['Duergar', duergar, 'Enlarge (Recharges after a Short or Long Rest)', 'ACTION'],
  ['Mimic', mimic, 'Pseudopod', 'ACTION']
]

describe('Immutable Form, Duergar Enlarge and Mimic Adhesive rider as GM rulings (D187a)', () => {
  it.each(CREATURES)('%s authors a ruling on %s', (_name, creature, label, kind) => {
    const feature = creature.features?.find((candidate) => candidate.label === label)
    const rulings = (feature?.effects ?? [])
      .flatMap(manualOutcomes)
      .filter((outcome) => outcome.effectKind === 'MANUAL_ADJUDICATION')
    expect(rulings).toHaveLength(1)
    expect(rulings[0]).toMatchObject({ reasonCode: 'GM_CHOICE' })
    expect(feature?.effects?.some((effect) => effect.invocation.kind === kind)).toBe(true)
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

  it('no longer lists the five closed rule kinds', () => {
    for (const kind of [
      'CREATURE_IMMUTABLE_FORM',
      'CREATURE_IRON_GOLEM_IMMUTABLE_FORM',
      'CREATURE_STONE_GOLEM_IMMUTABLE_FORM',
      'DUERGAR_ENLARGE',
      'CREATURE_MIMIC_PSEUDOPOD_ADHESIVE'
    ])
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
  })
})
