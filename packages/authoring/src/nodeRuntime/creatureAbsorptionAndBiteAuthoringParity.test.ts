import { describe, expect, it } from 'vitest'

import type { CreatureAuthored, EffectAuthored } from '@artificer-toolkit/shared'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { fleshGolem } from '@artificer-toolkit/source-data/srd/creatures/flesh-golem.js'
import { ironGolem } from '@artificer-toolkit/source-data/srd/creatures/iron-golem.js'
import { pitFiend } from '@artificer-toolkit/source-data/srd/creatures/pit-fiend.js'
import { shamblingMound } from '@artificer-toolkit/source-data/srd/creatures/shambling-mound.js'
import { vampire } from '@artificer-toolkit/source-data/srd/creatures/vampire.js'
import { vampireSpawn } from '@artificer-toolkit/source-data/srd/creatures/vampire-spawn.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T4n (D156, D187a): the three absorption traits and three healing-drain bites have no
 * absorb-to-heal piece, so each ships as a GM ruling beside the damage it already automates.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const ABSORPTIONS: [string, CreatureAuthored, string][] = [
  ['Flesh Golem', fleshGolem, 'Lightning Absorption'],
  ['Iron Golem', ironGolem, 'Fire Absorption'],
  ['Shambling Mound', shamblingMound, 'Lightning Absorption']
]

const BITES: [string, CreatureAuthored, string][] = [
  ['Pit Fiend', pitFiend, 'Bite'],
  ['Vampire', vampire, 'Bite (Bat or Vampire Form Only)'],
  ['Vampire Spawn', vampireSpawn, 'Bite']
]

const effectOf = (creature: CreatureAuthored, label: string): EffectAuthored => {
  const effect = creature.features?.find((feature) => feature.label === label)?.effects?.[0]
  if (!effect) throw new Error(`${creature.label} has no ${label} effect.`)
  return effect
}

const firstPathOutcomes = (effect: EffectAuthored) => {
  const path = effect.paths?.[0]
  return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
}

describe('absorption and healing-drain bites authored as GM rulings (D187a)', () => {
  it.each(ABSORPTIONS)('%s absorption is a GM ruling', (_name, creature, label) => {
    expect(firstPathOutcomes(effectOf(creature, label))).toMatchObject([
      { effectKind: 'MANUAL_ADJUDICATION', reasonCode: 'GM_CHOICE' }
    ])
  })

  it.each(BITES)('%s bite keeps its damage and adds a ruling', (_name, creature, label) => {
    const kinds = firstPathOutcomes(effectOf(creature, label)).map(({ effectKind }) => effectKind)
    expect(kinds).toContain('DAMAGE')
    expect(kinds.at(-1)).toBe('MANUAL_ADJUDICATION')
  })

  it.each([...ABSORPTIONS, ...BITES])(
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
      'CREATURE_FLESH_GOLEM_LIGHTNING_ABSORPTION',
      'CREATURE_IRON_GOLEM_FIRE_ABSORPTION',
      'CREATURE_SHAMBLING_MOUND_LIGHTNING_ABSORPTION',
      'CREATURE_PIT_FIEND_BITE',
      'CREATURE_VAMPIRE_BITE',
      'CREATURE_VAMPIRE_SPAWN_BITE'
    ])
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
  })
})
