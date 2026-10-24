import { describe, expect, it } from 'vitest'

import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { druid } from '@artificer-toolkit/source-data/srd/classes/druid.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T4s (ADR 0038, D156): the SRD druid's Wild Shape, Beast Spells and Archdruid are authored from
 * the core options a Builder author has on a class feature (a creature form whose filter and duration scale
 * with the class level, and GM rulings), so the class node map must keep them exactly as authored.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(values: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

function wildShapeForm(record: ClassAuthored) {
  const feature = record.features?.find(({ label }) => label === 'Wild Shape')
  const path = feature?.effects?.[0]?.paths[0]
  const outcome =
    path?.selectionKind === 'FIXED'
      ? path.resultBlock.outcomes.find(
          (candidate) =>
            candidate.effectKind === 'MANIFEST' && candidate.manifestKind === 'CREATURE'
        )
      : undefined
  if (outcome?.effectKind !== 'MANIFEST' || outcome.manifestKind !== 'CREATURE')
    throw new Error('The druid must author Wild Shape as a creature form.')
  return outcome
}

describe('the druid class features through the class node map (ADR 0038)', () => {
  it('keeps the SRD Wild Shape, Beast Spells and Archdruid exactly as authored, with no closed rule', async () => {
    expect(JSON.stringify(druid.features)).not.toMatch(
      /CLASS_DRUID_(WILD_SHAPE|BEAST_SPELLS|ARCHDRUID)/
    )
    const result = await normalize(druid)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(druid.features)
  })

  it('authors the Wild Shape cap as class-level breakpoints over the base filter', () => {
    expect(wildShapeForm(druid).formFilter).toMatchObject({
      challengeRatingCapKind: 'SCALED',
      scaling: { scalingSource: 'CLASS_LEVEL' }
    })
  })
})
