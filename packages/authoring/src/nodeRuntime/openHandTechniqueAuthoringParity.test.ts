import { describe, expect, it } from 'vitest'

import { collectOnHitRiders } from '@artificer-toolkit/rules-runtime/character/characterOnHitRiders'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { compileFeature } from '@artificer-toolkit/shared/compilers'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { FLURRY_OF_BLOWS_EFFECT_ID } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { wayOfTheOpenHand } from '@artificer-toolkit/source-data/srd/classes/way-of-the-open-hand.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-31.T4l2b (D156): Open Hand Technique is generic data, not a closed rule. Each option is an
 * ordinary passive `ON_HIT` Effect of the Feature that a `GRANTED_ACTION_OPTION` modifier names, so
 * it is a free optional rider of the attacks one granted action's Effect offers. The SRD feature
 * and a homebrew twin pass the class node map as authored and collect the same riders.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const TECHNIQUES = ['Knock prone', 'Push 15 feet', 'No reactions']

function normalize(values: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

function openHandTechnique(record: ClassAuthored): FeatureAuthored {
  const found = record.features?.find(({ label }) => label === 'Open Hand Technique')
  if (!found) throw new Error('The SRD record must author Open Hand Technique.')
  return found
}

/** A homebrew twin: another granted action, another option label and push distance. */
function twin(grantedByEffectId: string): ClassAuthored {
  const record = structuredClone(wayOfTheOpenHand)
  const authored = openHandTechnique(record)
  authored.grants = {
    ...authored.grants,
    modifiers: authored.grants?.modifiers?.map((modifier) =>
      modifier.valueDomainCode === 'GRANTED_ACTION_OPTION' &&
      modifier.payload &&
      'label' in modifier.payload
        ? {
            ...modifier,
            domain: { grantedByEffectId },
            payload: { ...modifier.payload, label: `Homebrew ${modifier.payload.label}` }
          }
        : modifier
    )
  }
  return record
}

function collect(record: ClassAuthored) {
  const compiled = compileFeature(openHandTechnique(record))
  return collectOnHitRiders(compiled.effects, compiled.id, compiled.label, compiled.modifiers)
}

describe('Open Hand Technique (SPELLS-31.T4l2b)', () => {
  it('no longer lists its closed rule kind', () => {
    expect(CLOSED_RULE_KIND).not.toHaveProperty('CLASS_WAY_OF_THE_OPEN_HAND_TECHNIQUE')
  })

  it('passes the class node map exactly as authored', async () => {
    const result = await normalize(wayOfTheOpenHand)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(wayOfTheOpenHand.features)
  })

  it('offers its three options as free optional riders of Flurry of Blows alone', () => {
    const riders = collect(wayOfTheOpenHand)
    expect(riders.map(({ label }) => label)).toEqual(TECHNIQUES)
    for (const rider of riders)
      expect(rider).toMatchObject({
        optionalOnHit: { kind: 'FREE' },
        grantedByEffectId: FLURRY_OF_BLOWS_EFFECT_ID
      })
  })

  it('keeps a homebrew twin as authored and collects the same riders under its own action', async () => {
    const homebrewAction = '7e57a000-0000-4000-8000-000000000051'
    const record = twin(homebrewAction)
    const result = await normalize(record)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(record.features)

    const riders = collect(record)
    expect(riders.map(({ label }) => label)).toEqual(TECHNIQUES.map((name) => `Homebrew ${name}`))
    for (const rider of riders)
      expect(rider).toMatchObject({
        optionalOnHit: { kind: 'FREE' },
        grantedByEffectId: homebrewAction
      })
  })
})
