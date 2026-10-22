import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { banditCaptain } from '@artificer-toolkit/source-data/srd/creatures/bandit-captain.js'
import { erinyes } from '@artificer-toolkit/source-data/srd/creatures/erinyes.js'
import { gladiator } from '@artificer-toolkit/source-data/srd/creatures/gladiator.js'
import { knight } from '@artificer-toolkit/source-data/srd/creatures/knight.js'
import { marilith } from '@artificer-toolkit/source-data/srd/creatures/marilith.js'
import { noble } from '@artificer-toolkit/source-data/srd/creatures/noble.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T4k1: Parry is authored from core options (an `ATTACKED_SELF` reaction qualified to a
 * melee attack the reactor sees, granting an Armor Class bonus used up by that attack), so an SRD
 * Creature and a Character feat hold the same reaction exactly as authored, with no closed rule.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(mapId: 'creature' | 'feat', values: object) {
  return normalizeNodeRuntimeValues(reader, {
    mapId,
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as Record<string, unknown>
  })
}

function parry(creature: CreatureAuthored) {
  const effect = creature.features?.find((feature) => feature.label === 'Parry')?.effects?.[0]
  if (!effect) throw new Error(`${creature.label} must author Parry.`)
  return effect
}

describe.each([
  ['Knight', knight],
  ['Noble', noble],
  ['Bandit Captain', banditCaptain],
  ['Gladiator', gladiator],
  ['Marilith', marilith],
  ['Erinyes', erinyes]
] as const)("%s's Parry from core options", (_name, creature) => {
  it('keeps the SRD Creature exactly as authored, with no closed rule', async () => {
    const effect = parry(creature)
    expect(JSON.stringify(effect)).not.toContain('CLOSED_RULE')
    expect(effect.invocation).toMatchObject({
      reactionTrigger: { kind: 'ATTACKED_SELF', attackRange: 'MELEE', requiresSight: true }
    })
    const result = await normalize('creature', creature)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
  })

  it('keeps the same reaction on a Character feat, as a custom feature authors it', async () => {
    const effect = parry(creature)
    const feat = { ...structuredClone(grappler), effects: [effect] }
    const result = await normalize('feat', feat)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual([effect])
  })
})
