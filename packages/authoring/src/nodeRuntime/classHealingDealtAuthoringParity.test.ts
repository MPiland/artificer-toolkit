import { describe, expect, it } from 'vitest'

import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T4n (ADR 0038): Disciple of Life is a caster-side healing bonus authored from the same
 * core options a Builder author has on a class feature, so it and a homebrew variant must pass the
 * class node map exactly as authored. Blessed Healer, Supreme Healing and Song of Rest are GM
 * rulings; Preserve Life is authored on the divided-heal option (SPELLS-31.T4f2c).
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

function rulingOutcome(authored: FeatureAuthored) {
  const path = authored.effects?.[0]?.paths[0]
  return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
}

/** Disciple of Life the way the Builder authors a homebrew one: a flat 3, without the spell level. */
function variant(): ClassAuthored {
  const record = structuredClone(lifeDomainCleric)
  const grant = feature(record, 'Disciple of Life').grants?.modifiers?.[0]
  if (grant?.valueDomainCode !== 'HEALING_DEALT')
    throw new Error('Disciple of Life must author a healing-dealt modifier.')
  grant.domain = { addsSpellLevel: false }
  grant.payload = { valueKind: 'FIXED', amount: 3 }
  return record
}

describe('a class feature’s healing-dealt bonus through the class node map (ADR 0038)', () => {
  it('leaves no closed rule for the five features', () => {
    for (const record of [lifeDomainCleric, bard])
      expect(JSON.stringify(record.features)).not.toMatch(
        /SONG_OF_REST|BLESSED_HEALER|DISCIPLE_OF_LIFE|PRESERVE_LIFE|SUPREME_HEALING/
      )
  })

  it('keeps the SRD Disciple of Life exactly as authored', async () => {
    expect(feature(lifeDomainCleric, 'Disciple of Life').grants?.modifiers?.[0]).toMatchObject({
      valueDomainCode: 'HEALING_DEALT',
      modifierKind: 'BONUS',
      domain: { addsSpellLevel: true },
      payload: { valueKind: 'FIXED', amount: 2 }
    })
    const result = await normalize(lifeDomainCleric)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(lifeDomainCleric.features)
  })

  it('keeps a homebrew bonus with another amount and no spell level the same way', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  it('authors the other three features as GM rulings', () => {
    for (const authored of [
      feature(lifeDomainCleric, 'Blessed Healer'),
      feature(lifeDomainCleric, 'Supreme Healing'),
      feature(bard, 'Song of Rest')
    ])
      expect(rulingOutcome(authored)).toMatchObject({ effectKind: 'MANUAL_ADJUDICATION' })
  })
})
