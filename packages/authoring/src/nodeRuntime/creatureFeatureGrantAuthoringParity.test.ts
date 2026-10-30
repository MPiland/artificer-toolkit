import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { balor } from '@artificer-toolkit/source-data/srd/creatures/balor.js'
import { invisibleStalker } from '@artificer-toolkit/source-data/srd/creatures/invisible-stalker.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T4de (D156): an SRD Creature's Magic Weapons and Invisible Stalker's Invisibility are
 * authored from core grant options, so a creature feature and a Character-side feature (a feat) hold
 * the same modifier exactly as authored, with no closed rule.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(mapId: 'creature' | 'feat', values: object) {
  return normalizeNodeRuntimeValues(reader, {
    mapId,
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as Record<string, unknown>
  })
}

function featureGrants(creature: CreatureAuthored, label: string) {
  const grants = creature.features?.find((feature) => feature.label === label)?.grants
  if (!grants?.modifiers?.length) throw new Error(`${label} must author grants.`)
  return grants
}

describe.each([
  ['Magic Weapons', balor, 'ATTACK_TRAIT'],
  ['Invisibility', invisibleStalker, 'CONDITION']
] as const)('%s from a core option', (label, creature, valueDomainCode) => {
  it('keeps the SRD Creature exactly as authored, with no closed rule on the feature', async () => {
    const grants = featureGrants(creature, label)
    expect(grants.modifiers?.[0]?.valueDomainCode).toBe(valueDomainCode)
    const feature = creature.features?.find((entry) => entry.label === label)
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    const result = await normalize('creature', creature)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
  })

  it('keeps the same grant on a Character feat, as a custom feature authors it', async () => {
    const grants = featureGrants(creature, label)
    const feat = { ...structuredClone(grappler), effects: [], grants }
    const result = await normalize('feat', feat)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['grants'])).toEqual(grants)
  })
})
