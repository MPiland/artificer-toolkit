import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { chainDevil } from '@artificer-toolkit/source-data/srd/creatures/chain-devil.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T6e: the SRD Chain Devil's Unnerving Mask is a passive zone that frightens a creature
 * starting its turn in view of the devil, authored from the same core options a Builder author has
 * on a creature feature (a sight requirement, a fixed-DC save, a condition until the end of the
 * holder's turn). It must pass the creature node map exactly as authored, as must a variant with
 * one-way sight and another DC.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

/** The Unnerving Mask's one zone component, found by narrowing the authored record. */
function maskComponent(creature: CreatureAuthored) {
  const feature = creature.features?.find(({ label }) => label === 'Unnerving Mask')
  const path = feature?.effects?.[0]?.paths[0]
  const zone = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  const component =
    zone?.effectKind === 'MANIFEST' && zone.manifestKind === 'ZONE'
      ? zone.components?.[0]
      : undefined
  if (!feature || !component) throw new Error('The Chain Devil must author its Unnerving Mask.')
  return { feature, component }
}

describe('a creature’s sight-gated passive zone through the creature node map', () => {
  it('keeps the SRD Chain Devil’s Unnerving Mask exactly as authored, with no closed rule', async () => {
    const { feature, component } = maskComponent(chainDevil)
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    expect(component.interactionKinds).toEqual(['START_TURN_IN_SPACE'])
    expect(component.requiredSight).toEqual(['OCCUPANT_SEES_SOURCE', 'SOURCE_SEES_OCCUPANT'])
    const result = await normalize(chainDevil)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(chainDevil.features)
  })

  it('keeps a mask that needs only the occupant’s sight, at another DC, the same way', async () => {
    const authored = structuredClone(chainDevil)
    const { component } = maskComponent(authored)
    component.requiredSight = ['OCCUPANT_SEES_SOURCE']
    const invocation = component.behaviors?.[0]?.invocation
    if (
      !invocation ||
      !('savingThrow' in invocation) ||
      invocation.savingThrow.dcMethod !== 'FIXED_DC'
    )
      throw new Error('The mask must save at a fixed DC.')
    invocation.savingThrow.baseDc = 16
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
