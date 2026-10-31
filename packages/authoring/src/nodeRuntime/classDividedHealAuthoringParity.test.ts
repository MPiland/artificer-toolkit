import { describe, expect, it } from 'vitest'

import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T4f2c: Preserve Life is a pool heal the caster divides among chosen creatures, authored
 * from core options, so the SRD feature and a homebrew divided pool pass the class node map as
 * authored.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(values: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

function preserveLife(record: ClassAuthored): FeatureAuthored {
  const found = record.features?.find(
    (candidate) => candidate.label === 'Channel Divinity: Preserve Life'
  )
  if (!found) throw new Error('The SRD record must author Preserve Life.')
  return found
}

function dividedHeal(authored: FeatureAuthored) {
  const path = authored.effects?.[0]?.paths[0]
  return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
}

/** A homebrew divided pool: 3 per level, each creature restored to at most a third of its maximum. */
function variant(): ClassAuthored {
  const record = structuredClone(lifeDomainCleric)
  const outcome = dividedHeal(preserveLife(record))
  if (outcome?.effectKind !== 'HEAL' || outcome.valueKind !== 'POOL')
    throw new Error('Preserve Life must author a pool heal.')
  outcome.multiplier = 3
  outcome.splitCeiling = { numerator: 1, denominator: 3 }
  return record
}

describe('a pool heal the caster divides, through the class node map', () => {
  it('authors Preserve Life from core options with no closed rule', () => {
    const authored = preserveLife(lifeDomainCleric)
    expect(JSON.stringify(authored.effects)).not.toMatch(/CLOSED_RULE|GM_RULING|PRESERVE_LIFE/)
    expect(dividedHeal(authored)).toMatchObject({
      effectKind: 'HEAL',
      valueKind: 'POOL',
      scalingSource: 'CLASS_LEVEL',
      multiplier: 5,
      splitKind: 'CASTER_DIVIDES',
      splitCeiling: { numerator: 1, denominator: 2 }
    })
  })

  it('keeps the SRD Preserve Life exactly as authored', async () => {
    const result = await normalize(lifeDomainCleric)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(lifeDomainCleric.features)
  })

  it('keeps a homebrew divided pool with another size and ceiling the same way', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
