import { describe, expect, it } from 'vitest'

import type { CreatureAuthored, EffectAuthored } from '@artificer-toolkit/shared'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { ghost } from '@artificer-toolkit/source-data/srd/creatures/ghost.js'
import { kraken } from '@artificer-toolkit/source-data/srd/creatures/kraken.js'
import { medusa } from '@artificer-toolkit/source-data/srd/creatures/medusa.js'
import { vrock } from '@artificer-toolkit/source-data/srd/creatures/vrock.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T4m (D156, D187a): Horrifying Visage, Petrifying Gaze, Vrock Spores and the Kraken's
 * Freedom of Movement are authored from generic options (condition outcomes, repeated saves, a
 * failure-margin rider, a source-trait condition immunity), with the parts no option expresses as
 * GM rulings. Each creature must pass its node map exactly as authored.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const CREATURES: [string, CreatureAuthored][] = [
  ['Ghost', ghost],
  ['Kraken', kraken],
  ['Medusa', medusa],
  ['Vrock', vrock]
]

const effectOf = (creature: CreatureAuthored, label: string): EffectAuthored => {
  const effect = creature.features?.find((feature) => feature.label === label)?.effects?.[0]
  if (!effect) throw new Error(`${creature.label} has no ${label} effect.`)
  return effect
}

const outcomesOf = (effect: EffectAuthored) =>
  (effect.paths ?? [])
    .slice(0, 1)
    .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))

describe('creature traits authored from generic options (D187a)', () => {
  it.each([
    ['Ghost', ghost, 'Horrifying Visage', ['CONDITION', 'FOLLOW_UP_SAVE', 'MANUAL_ADJUDICATION']],
    ['Vrock', vrock, 'Spores (Recharge 6)', ['CONDITION', 'FOLLOW_UP_SAVE', 'MANUAL_ADJUDICATION']],
    ['Medusa', medusa, 'Petrifying Gaze', ['CONDITION', 'FOLLOW_UP_SAVE', 'MANUAL_ADJUDICATION']]
  ] as const)(
    '%s condition trait repeats its save and keeps no closed rule',
    (_n, creature, label, kinds) => {
      expect(outcomesOf(effectOf(creature, label)).map(({ effectKind }) => effectKind)).toEqual(
        kinds
      )
    }
  )

  it('Kraken holds a magical-source restrained immunity beside its ruling', () => {
    const feature = kraken.features?.find(({ label }) => label === 'Freedom of Movement')
    expect(feature?.grants?.modifiers).toHaveLength(1)
    expect(feature?.grants?.modifiers?.[0]).toMatchObject({
      valueDomainCode: 'CONDITION_IMMUNITY',
      modifierKind: 'ADD_OPTION'
    })
    expect(outcomesOf(effectOf(kraken, 'Freedom of Movement'))).toMatchObject([
      { effectKind: 'MANUAL_ADJUDICATION', reasonCode: 'GM_CHOICE' }
    ])
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

  it('no longer lists the four closed rule kinds', () => {
    for (const kind of [
      'CREATURE_GHOST_HORRIFYING_VISAGE',
      'CREATURE_KRAKEN_FREEDOM_OF_MOVEMENT',
      'CREATURE_MEDUSA_PETRIFYING_GAZE',
      'CREATURE_VROCK_SPORES'
    ])
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
  })
})
