import { describe, expect, it } from 'vitest'

import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eVocabularyCapabilityAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/vocabulary'

/**
 * SPELLS-20 T5a (ADR 0038, D155): the SRD paladin's Aura of Protection is a passive source zone that
 * lends its occupants a save bonus, authored from the same core options a Builder author has on a
 * class feature, so it must pass the class node map exactly as authored, as must a homebrew variant
 * with a fixed bonus and an unscaled radius.
 */

const reader = createSrdNodeRuntimeReader(dnd5eVocabularyCapabilityAdapter.lists)

function normalize(values: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

/** The Aura of Protection feature and its one zone, found by narrowing the authored record. */
function auraOfProtection(record: ClassAuthored) {
  const feature = record.features?.find(({ label }) => label === 'Aura of Protection')
  const effect = feature?.effects?.[0]
  const path = effect?.paths[0]
  const zone = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  if (!feature || !effect || zone?.effectKind !== 'MANIFEST' || zone.manifestKind !== 'ZONE')
    throw new Error('The paladin must author its Aura of Protection as a zone.')
  return { feature, effect, zone }
}

/** The aura the way the Builder authors it for a homebrew class: a flat +2 within 15 feet. */
function variant(): ClassAuthored {
  const record = structuredClone(paladin)
  const { effect, zone } = auraOfProtection(record)
  const radius = { amount: 15, unit: 'FEET' as const }
  const { shape: invocationShape } = effect.invocation
  const { shape: zoneShape } = zone
  const component = zone.components?.[0]
  if (
    invocationShape?.shapeKind !== 'SPHERE' ||
    zoneShape?.shapeKind !== 'SPHERE' ||
    !component?.occupantSaveBonus
  )
    throw new Error('The aura must author a sphere and an occupant save bonus.')
  effect.invocation.shape = { ...invocationShape, radius }
  zone.shape = { ...zoneShape, radius }
  component.occupantSaveBonus = {
    id: component.occupantSaveBonus.id,
    domain: 'EVERY_SAVING_THROW',
    amountKind: 'FIXED',
    amount: 2,
    dispositionFilter: 'ALLIES_AND_SOURCE'
  }
  return record
}

describe('a class feature’s occupant save-bonus aura through the class node map (ADR 0038)', () => {
  it('keeps the SRD Aura of Protection exactly as authored, with no closed rule', async () => {
    const { feature, zone } = auraOfProtection(paladin)
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    expect(zone.components?.[0]?.occupantSaveBonus).toMatchObject({
      domain: 'EVERY_SAVING_THROW',
      amountKind: 'SOURCE_ABILITY_MODIFIER',
      ability: 'CHARISMA',
      minimum: 1,
      dispositionFilter: 'ALLIES_AND_SOURCE'
    })
    const result = await normalize(paladin)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(paladin.features)
  })

  it('keeps an aura with a fixed bonus and another radius the same way', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
