import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { mimic } from '@artificer-toolkit/source-data/srd/creatures/mimic.js'
import { GRAPPLED_CONDITION_ID } from '@artificer-toolkit/source-data/srd/creatures/shared.js'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T8a (Q30): the Mimic's Grappler is an attacker-side ROLL_INFLUENCE grant, "advantage on
 * attacks against a creature I hold with condition X", the same options a Builder author has on a
 * creature feature, so it must pass the creature node map exactly as authored. A homebrew creature
 * authoring the same grants with another held condition must pass identically (authoring parity).
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

describe('a held-creature attack advantage through the creature node map (SPELLS-33 T8a)', () => {
  it('keeps the Mimic Grappler and Pseudopod grapple exactly as authored, with no closed rule', async () => {
    const feature = mimic.features?.find(({ label }) => label === 'Grappler')
    expect(feature?.grants?.modifiers?.length).toBeGreaterThan(0)
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    expect(JSON.stringify(feature)).toContain(GRAPPLED_CONDITION_ID)
    const result = await normalize(mimic)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(mimic.features)
  })

  it('keeps the same grants authored on a homebrew creature against another held condition', async () => {
    const authored = structuredClone(mimic)
    const grants = authored.features?.find(({ label }) => label === 'Grappler')?.grants
    if (!grants?.modifiers) throw new Error('The Mimic must author Grappler grants.')
    const restrained = SRD_CONDITION_TYPES.find(({ code }) => code === 'RESTRAINED')
    if (!restrained) throw new Error('The SRD must define Restrained.')
    for (const grant of grants.modifiers) {
      const { domain } = grant
      if (!domain || !('attackDomain' in domain))
        throw new Error('Grappler grants must author an attack domain.')
      expect('againstHeldConditionTypeId' in domain && domain.againstHeldConditionTypeId).toBe(
        GRAPPLED_CONDITION_ID
      )
      grant.domain = { ...domain, againstHeldConditionTypeId: restrained.id }
    }
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
