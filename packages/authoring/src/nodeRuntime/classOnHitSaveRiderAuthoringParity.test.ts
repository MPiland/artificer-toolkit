import { describe, expect, it } from 'vitest'

import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { theFiend } from '@artificer-toolkit/source-data/srd/classes/the-fiend.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T5rb: Stunning Strike is a generic optional on-hit rider, not a closed rule. A melee hit
 * the holder may pay a resource pool unit for calls a save against a DC derived from the holder, and
 * a failure holds a condition until the end of the holder's next turn. The SRD feature and a homebrew
 * variant pass the class node map as authored from the same core options.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(values: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

function feature(record: ClassAuthored, label: string): FeatureAuthored {
  const found = record.features?.find((candidate) => candidate.label === label)
  if (!found) throw new Error(`The SRD record must author ${label}.`)
  return found
}

function riderSave(authored: FeatureAuthored) {
  const path = authored.effects?.[0]?.paths?.[0]
  const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  if (outcome?.effectKind !== 'FOLLOW_UP_SAVE')
    throw new Error('Stunning Strike must author a follow-up save.')
  return outcome
}

/** A homebrew rider the way the Builder authors one: two pool units, a higher base DC. */
function variant(): ClassAuthored {
  const record = structuredClone(monk)
  const authored = feature(record, 'Stunning Strike')
  const invocation = authored.effects?.[0]?.invocation
  if (invocation?.kind !== 'PASSIVE' || invocation.optionalOnHit?.kind !== 'RESOURCE_POOL')
    throw new Error('Stunning Strike must charge a resource pool.')
  invocation.optionalOnHit.cost = 2
  const { savingThrow } = riderSave(authored)
  if (savingThrow.dcMethod !== 'DERIVED_DC') throw new Error('Stunning Strike derives its DC.')
  savingThrow.baseDc = 10
  return record
}

describe('an optional on-hit rider that calls a derived-DC save, through the class node map', () => {
  it('authors Stunning Strike from core options with no closed rule', () => {
    const authored = feature(monk, 'Stunning Strike')
    expect(JSON.stringify(authored.effects)).not.toMatch(/CLOSED_RULE|STUNNING_STRIKE/)
    expect(authored.effects?.[0]?.invocation).toMatchObject({
      optionalOnHit: { kind: 'RESOURCE_POOL', cost: 1 }
    })
    expect(riderSave(authored)).toMatchObject({
      timing: 'IMMEDIATE',
      savingThrow: { dcMethod: 'DERIVED_DC', baseDc: 8 }
    })
  })

  it('keeps the SRD Stunning Strike exactly as authored', async () => {
    const result = await normalize(monk)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(monk.features)
  })

  it('keeps a homebrew rider with another cost and base DC the same way', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  it('rules Hurl Through Hell as a GM ruling that spends its charge, with no closed rule', async () => {
    const authored = feature(theFiend, 'Hurl Through Hell')
    expect(JSON.stringify(authored.effects)).not.toMatch(/CLOSED_RULE|HURL_THROUGH_HELL/)
    expect(authored.effects?.[0]?.invocation).toMatchObject({
      resourceUse: { chargeId: authored.charges?.id, cost: 1 }
    })
    const result = await normalize(theFiend)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(theFiend.features)
  })
})
