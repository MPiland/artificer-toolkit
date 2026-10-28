import { describe, expect, it } from 'vitest'

import type { ClassAuthored, FeatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { draconicBloodlineOrigin } from '@artificer-toolkit/source-data/srd/classes/draconic-bloodline.js'
import { oathOfDevotion } from '@artificer-toolkit/source-data/srd/classes/oath-of-devotion.js'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T4r (ADR 0038, D155 amendment): Aura of Courage and Aura of Devotion are passive source
 * zones that keep a condition off their occupants, authored from the same core options a Builder
 * author has on a class feature, so they and a homebrew variant must pass the class node map exactly
 * as authored. Holy Nimbus, Countercharm and Draconic Presence are GM rulings.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const conditionId = (code: string) =>
  srdSystemRecord.conditionTypes.find((condition) => condition.code === code)?.id

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

/** The one zone component a feature's aura authors. */
function auraComponent(authored: FeatureAuthored) {
  const path = authored.effects?.[0]?.paths[0]
  const zone = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  const component =
    zone?.effectKind === 'MANIFEST' && zone.manifestKind === 'ZONE'
      ? zone.components?.[0]
      : undefined
  if (!component) throw new Error(`${authored.label} must author one zone component.`)
  return component
}

function rulingOutcome(authored: FeatureAuthored) {
  const path = authored.effects?.[0]?.paths[0]
  return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
}

/** Aura of Courage the way the Builder authors a homebrew one: no charm or fright within 15 feet. */
function variant(): ClassAuthored {
  const record = structuredClone(paladin)
  const authored = feature(record, 'Aura of Courage')
  const effect = authored.effects?.[0]
  const path = effect?.paths[0]
  const zone = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  const component = auraComponent(authored)
  if (
    effect?.invocation.shape?.shapeKind !== 'SPHERE' ||
    zone?.effectKind !== 'MANIFEST' ||
    zone.shape?.shapeKind !== 'SPHERE' ||
    !component.occupantConditionImmunity
  )
    throw new Error('The aura must author a sphere and an occupant condition immunity.')
  const radius = { amount: 15, unit: 'FEET' as const }
  effect.invocation.shape = { ...effect.invocation.shape, radius }
  zone.shape = { ...zone.shape, radius }
  component.occupantConditionImmunity = {
    ...component.occupantConditionImmunity,
    conditionTypeIds: ['CHARMED', 'FRIGHTENED'].map((code) => conditionId(code) ?? code)
  }
  return record
}

describe('a class feature’s occupant condition-immunity aura through the class node map (ADR 0038)', () => {
  it('leaves no closed rule for the five features', () => {
    for (const record of [paladin, oathOfDevotion, bard, draconicBloodlineOrigin])
      expect(JSON.stringify(record.features)).not.toMatch(
        /AURA_OF_COURAGE|AURA_OF_DEVOTION|HOLY_NIMBUS|COUNTERCHARM|DRACONIC_PRESENCE/
      )
  })

  it.each([
    ['Aura of Courage', paladin, 'FRIGHTENED'],
    ['Aura of Devotion', oathOfDevotion, 'CHARMED']
  ] as const)('keeps the SRD %s exactly as authored', async (label, record, code) => {
    expect(conditionId(code)).toBeDefined()
    expect(auraComponent(feature(record, label)).occupantConditionImmunity).toMatchObject({
      conditionTypeIds: [conditionId(code)],
      dispositionFilter: 'ALLIES_AND_SOURCE'
    })
    const result = await normalize(record)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(record.features)
  })

  it('keeps a homebrew aura with two conditions and another radius the same way', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  it('authors Holy Nimbus, Countercharm and Draconic Presence as GM rulings taking an action', () => {
    for (const authored of [
      feature(oathOfDevotion, 'Holy Nimbus'),
      feature(bard, 'Countercharm'),
      feature(draconicBloodlineOrigin, 'Draconic Presence')
    ]) {
      expect(rulingOutcome(authored)).toMatchObject({ effectKind: 'MANUAL_ADJUDICATION' })
      expect(authored.effects?.[0]?.invocation).toMatchObject({
        kind: 'ACTION',
        activation: { code: 'ACTION' }
      })
    }
    expect(feature(oathOfDevotion, 'Holy Nimbus').effects?.[0]?.invocation).toMatchObject({
      resourceUse: { chargeId: feature(oathOfDevotion, 'Holy Nimbus').charges?.id, cost: 1 }
    })
  })
})
