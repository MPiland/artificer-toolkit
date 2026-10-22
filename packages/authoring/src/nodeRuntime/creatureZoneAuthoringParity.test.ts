import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { balor } from '@artificer-toolkit/source-data/srd/creatures/balor.js'
import { remorhaz } from '@artificer-toolkit/source-data/srd/creatures/remorhaz.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-20 T6c (ADR 0038, D144): the SRD Balor's Fire Aura is a passive zone authored from the same
 * core options a Builder author has on a creature feature, so it must pass the creature node map
 * exactly as authored, as must a variant with another radius and other dice.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

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

  it('keeps a zone acting on entering, leaving and each turn boundary inside (RULES-2.T5d)', async () => {
    const authored = variant()
    const component = fireAura(authored).zone.components?.[0]
    if (!component) throw new Error('The aura must author a component.')
    component.interactionKinds = [
      'ENTER_SPACE',
      'START_TURN_IN_SPACE',
      'END_TURN_IN_SPACE',
      'LEAVE_SPACE'
    ]
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})

/**
 * SPELLS-33 T4k2 (D156): the SRD Remorhaz's Heated Body is a passive melee trait authored from core
 * options, with no zone and no closed rule: a PASSIVE melee effect with a distance range and direct
 * damage. A Builder author's variant with another range and other dice must pass the node map too.
 */
describe('a creature’s passive melee retaliation trait through the creature node map (ADR 0038)', () => {
  function heatedBody(creature: CreatureAuthored) {
    const effect = creature.features?.find(({ label }) => label === 'Heated Body')?.effects?.[0]
    const path = effect?.paths[0]
    const damage = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
    if (!effect || damage?.effectKind !== 'DAMAGE' || !('diceConfig' in damage))
      throw new Error('The Remorhaz must author Heated Body as passive dice damage.')
    return { effect, damage }
  }

  it('keeps the SRD Remorhaz’s Heated Body exactly as authored, with no closed rule', async () => {
    const { effect } = heatedBody(remorhaz)
    expect(effect.invocation).toMatchObject({ kind: 'PASSIVE', triggerCode: 'MELEE_WEAPON_ATTACK' })
    expect(JSON.stringify(effect)).not.toContain('CLOSED_RULE')
    const result = await normalize(remorhaz)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(remorhaz.features)
  })

  it('keeps a trait with another range and other dice the same way', async () => {
    const authored = structuredClone(remorhaz)
    const { effect, damage } = heatedBody(authored)
    if (effect.invocation.range?.rangeKind !== 'DISTANCE')
      throw new Error('The trait must author a distance range.')
    effect.invocation.range = { ...effect.invocation.range, amount: 10 }
    damage.diceConfig = '2d8'
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
