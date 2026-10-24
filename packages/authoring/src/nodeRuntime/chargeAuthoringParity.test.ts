import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { giantElk } from '@artificer-toolkit/source-data/srd/creatures/giant-elk.js'
import { minotaurSkeleton } from '@artificer-toolkit/source-data/srd/creatures/minotaur-skeleton.js'
import { unicorn } from '@artificer-toolkit/source-data/srd/creatures/unicorn.js'
import { wereboar } from '@artificer-toolkit/source-data/srd/creatures/wereboar.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T5n2 (D156, D164): a straight-line Charge is a passive ON_HIT rider that rides one named
 * Feature's attack, gated on the attacker closing on its target, with its damage and save in the
 * hit. The SRD Charges and a homebrew one riding another attack pass the creature node map exactly as
 * authored; a rider naming a Feature the creature does not have is cleared.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

/** The Giant Elk with its Charge rewritten to ride the given Feature. */
function elkChargeRiding(ridesFeatureId: string): CreatureAuthored {
  const authored = structuredClone(giantElk)
  const charge = authored.features?.find(({ label }) => label === 'Charge')?.effects?.[0]
  if (charge?.invocation.kind !== 'PASSIVE') throw new Error('The elk’s Charge must be passive.')
  charge.invocation.ridesFeatureId = ridesFeatureId
  return authored
}

describe('a Feature-scoped Charge through the creature node map (SPELLS-33.T5n2)', () => {
  it.each([
    ['Giant Elk', giantElk],
    ['Minotaur Skeleton', minotaurSkeleton],
    ['Unicorn', unicorn],
    ['Wereboar', wereboar]
  ])('keeps the SRD %s’s Charge exactly as authored', async (_label, creature) => {
    const result = await normalize(creature)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
  })

  it('keeps a homebrew Charge riding another of the creature’s attacks', async () => {
    const hooves = giantElk.features?.find(({ label }) => label === 'Hooves')
    if (!hooves) throw new Error('The Giant Elk must author Hooves.')
    const authored = elkChargeRiding(hooves.id)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  it('clears a Charge riding a Feature the creature does not have', async () => {
    const result = await normalize(elkChargeRiding('00000000-0000-0000-0000-00000000dead'))
    expect(result.clearedPaths).toEqual([
      ['features', 0, 'effects', 0, 'invocation', 'ridesFeatureId']
    ])
  })
})
