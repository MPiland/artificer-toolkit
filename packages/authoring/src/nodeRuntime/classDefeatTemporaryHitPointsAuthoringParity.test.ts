import { describe, expect, it } from 'vitest'

import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { theFiend } from '@artificer-toolkit/source-data/srd/classes/the-fiend.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T4i2 (ADR 0038, D156): Dark One's Blessing is a `DEFEAT_TEMPORARY_HIT_POINTS` bonus
 * authored from the same core options a Builder author has on a class feature, so it and a homebrew
 * variant must pass the class node map exactly as authored.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(values: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

function blessing(record: ClassAuthored): FeatureAuthored {
  const found = record.features?.find(({ label }) => label === "Dark One's Blessing")
  if (!found) throw new Error("The SRD Fiend must author Dark One's Blessing.")
  return found
}

/** The blessing the way the Builder authors a homebrew one: a flat 5 instead of the two SRD terms. */
function variant(): ClassAuthored {
  const record = structuredClone(theFiend)
  const grants = blessing(record).grants?.modifiers
  if (!grants?.[0]) throw new Error("Dark One's Blessing must author modifier grants.")
  grants.splice(1)
  grants[0].payload = { valueKind: 'FIXED', amount: 5 }
  return record
}

describe('a class feature’s defeat temporary hit points through the class node map (ADR 0038)', () => {
  it('leaves no closed rule for Dark One’s Blessing', () => {
    expect(JSON.stringify(blessing(theFiend))).not.toContain('CLASS_FIEND_DARK_ONES_BLESSING')
  })

  it('keeps the SRD blessing exactly as authored', async () => {
    expect(blessing(theFiend).grants?.modifiers).toMatchObject([
      {
        valueDomainCode: 'DEFEAT_TEMPORARY_HIT_POINTS',
        modifierKind: 'BONUS',
        payload: { valueKind: 'ABILITY_MODIFIER', ability: 'CHARISMA' }
      },
      {
        valueDomainCode: 'DEFEAT_TEMPORARY_HIT_POINTS',
        modifierKind: 'BONUS',
        payload: { valueKind: 'CLASS_LEVEL', multiplier: 1 }
      }
    ])
    const result = await normalize(theFiend)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(theFiend.features)
  })

  it('keeps a homebrew flat amount the same way', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
