import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { flyingSnake } from '@artificer-toolkit/source-data/srd/creatures/flying-snake.js'
import { giantOwl } from '@artificer-toolkit/source-data/srd/creatures/giant-owl.js'
import { owl } from '@artificer-toolkit/source-data/srd/creatures/owl.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eVocabularyCapabilityAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/vocabulary'

/**
 * SPELLS-33.T5k: Flyby is authored from a core option (an enabled `OPPORTUNITY_ATTACK_IMMUNITY`
 * grant), so an SRD Creature and a Character feat hold the same grant exactly as authored, with no
 * closed rule.
 */

const reader = createSrdNodeRuntimeReader(dnd5eVocabularyCapabilityAdapter.lists)

function normalize(mapId: 'creature' | 'feat', values: object) {
  return normalizeNodeRuntimeValues(reader, {
    mapId,
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as Record<string, unknown>
  })
}

function flybyGrants(creature: CreatureAuthored) {
  const grants = creature.features?.find((feature) => feature.label === 'Flyby')?.grants
  if (!grants) throw new Error(`${creature.label} must author Flyby.`)
  return grants
}

describe.each([
  ['Owl', owl],
  ['Giant Owl', giantOwl],
  ['Flying Snake', flyingSnake]
] as const)("%s's Flyby from core options", (_name, creature) => {
  it('keeps the SRD Creature exactly as authored, with no closed rule', async () => {
    const grants = flybyGrants(creature)
    expect(JSON.stringify(creature.features)).not.toContain('CLOSED_RULE')
    expect(grants.modifiers).toMatchObject([
      { valueDomainCode: 'OPPORTUNITY_ATTACK_IMMUNITY', modifierKind: 'ENABLE' }
    ])
    const result = await normalize('creature', creature)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
  })

  it('keeps the same grant on a Character feat, as a custom feature authors it', async () => {
    const grants = flybyGrants(creature)
    const feat = { ...structuredClone(grappler), grants }
    const result = await normalize('feat', feat)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['grants'])).toEqual(grants)
  })
})
