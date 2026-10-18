import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { balor } from '@artificer-toolkit/source-data/srd/creatures/balor.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-20 T6c (ADR 0038, D144): the SRD Balor's Fire Aura is a passive zone authored from the same
 * core options a Builder author has on a creature feature, so it must pass the creature node map
 * exactly as authored, as must a variant with another radius and other dice.
 */

const reader = createSrdNodeRuntimeReader()

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

/** The Balor's Fire Aura feature and its one zone, found by narrowing the authored record. */
function fireAura(creature: CreatureAuthored) {
  const feature = creature.features?.find(({ label }) => label === 'Fire Aura')
  const effect = feature?.effects?.[0]
  const path = effect?.paths[0]
  const zone = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  if (!feature || !effect || zone?.effectKind !== 'MANIFEST' || zone.manifestKind !== 'ZONE')
    throw new Error('The Balor must author its Fire Aura as a zone.')
  return { feature, effect, zone }
}

/** The aura the way the Builder authors it for a homebrew creature: 10 feet, 2d8 fire. */
function variant(): CreatureAuthored {
  const creature = structuredClone(balor)
  const { effect, zone } = fireAura(creature)
  const radius = { amount: 10, unit: 'FEET' as const }
  const { shape: invocationShape } = effect.invocation
  const { shape: zoneShape } = zone
  if (invocationShape?.shapeKind !== 'SPHERE' || zoneShape?.shapeKind !== 'SPHERE')
    throw new Error('The aura must author a sphere.')
  effect.invocation.shape = { ...invocationShape, radius }
  zone.shape = { ...zoneShape, radius }
  const behaviorPath = zone.components?.[0]?.behaviors?.[0]?.paths[0]
  const damage =
    behaviorPath?.selectionKind === 'FIXED' ? behaviorPath.resultBlock.outcomes[0] : undefined
  if (damage?.effectKind !== 'DAMAGE' || !('diceConfig' in damage))
    throw new Error('The aura must author dice damage.')
  damage.diceConfig = '2d8'
  return creature
}

describe('a creature’s passive zone through the creature node map (ADR 0038)', () => {
  it('keeps the SRD Balor’s Fire Aura exactly as authored, with no closed rule', async () => {
    const { feature, zone } = fireAura(balor)
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    // One component burns at the source's turn start and answers a melee hit (T6d1, D153).
    expect(zone.components?.[0]?.interactionKinds).toEqual([
      'START_OF_SOURCE_TURN',
      'MELEE_HIT_ON_SOURCE'
    ])
    const result = await normalize(balor)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(balor.features)
  })

  it('keeps an aura with another radius and other dice the same way', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
