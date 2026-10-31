import { describe, expect, it } from 'vitest'

import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import {
  SRD_CREATURE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T4f2a/T4f2b: Lay on Hands is a generic pool option, not a closed rule. A charged pool
 * feature whose action heals one hit point per unit the user spends, and whose second action spends
 * a fixed cost to end a condition, both filtered by creature type, is authored from the same core
 * options a Builder author has, so the SRD feature and a homebrew pool pass the class node map as
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

function feature(record: ClassAuthored, label: string): FeatureAuthored {
  const found = record.features?.find((candidate) => candidate.label === label)
  if (!found) throw new Error(`The SRD record must author ${label}.`)
  return found
}

function spentHeal(authored: FeatureAuthored) {
  const path = authored.effects?.[0]?.paths[0]
  return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
}

const creatureTypeId = (code: string) => {
  const found = SRD_CREATURE_TYPES.find((type) => type.code === code)
  if (!found) throw new Error(`The SRD has the ${code} creature type.`)
  return found.id
}

function cureOutcome(authored: FeatureAuthored) {
  const path = authored.effects?.[1]?.paths[0]
  return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
}

/** A homebrew pool the way the Builder authors one: 2 hit points per unit, 3 per level, short rest. */
function variant(): ClassAuthored {
  const record = structuredClone(paladin)
  const authored = feature(record, 'Lay on Hands')
  if (authored.charges?.limitKind !== 'CLASS_LEVEL')
    throw new Error('Lay on Hands must author a class-level pool.')
  authored.charges.multiplier = 3
  authored.charges.resetKind = 'SHORT_REST'
  const outcome = spentHeal(authored)
  if (outcome?.effectKind !== 'HEAL' || outcome.valueKind !== 'RESOURCE_SPENT')
    throw new Error('Lay on Hands must author a per-unit heal.')
  outcome.amount = 2
  // The same options re-authored: the cure costs 3 and the pool spares beasts instead.
  const [heal, cure] = authored.effects ?? []
  if (heal?.invocation.kind !== 'ACTION' || cure?.invocation.kind !== 'ACTION')
    throw new Error('Lay on Hands must author a heal and a cure action.')
  if (!cure.invocation.resourceUse) throw new Error('The cure must spend from the pool.')
  cure.invocation.resourceUse.cost = 3
  for (const { invocation } of [heal, cure])
    if (invocation.targeting?.selectionKind === 'SINGLE_TARGET')
      invocation.targeting.excludedCreatureTypeIds = [creatureTypeId('BEAST')]
  return record
}

describe('a pool feature that heals per unit spent, through the class node map', () => {
  it('authors Lay on Hands from core options with no closed rule', () => {
    const authored = feature(paladin, 'Lay on Hands')
    expect(JSON.stringify(authored.effects)).not.toMatch(/CLOSED_RULE|LAY_ON_HANDS/)
    expect(authored.charges).toMatchObject({
      limitKind: 'CLASS_LEVEL',
      multiplier: 5,
      resetKind: 'LONG_REST'
    })
    expect(authored.effects?.[0]?.invocation).toMatchObject({
      resourceUse: { chargeId: authored.charges?.id, cost: 1 }
    })
    expect(spentHeal(authored)).toMatchObject({
      effectKind: 'HEAL',
      valueKind: 'RESOURCE_SPENT',
      amount: 1
    })
  })

  it('authors the 5-point cure and the undead and construct filter from core options', () => {
    const authored = feature(paladin, 'Lay on Hands')
    const [heal, cure] = authored.effects ?? []
    expect(cure?.invocation).toMatchObject({
      resourceUse: { chargeId: authored.charges?.id, cost: 5 }
    })
    expect(cureOutcome(authored)).toMatchObject({
      effectKind: 'END_EFFECTS',
      scope: 'ONE_CHOSEN',
      selectors: [{ kind: 'CONDITION' }]
    })
    for (const effect of [heal, cure])
      expect(effect?.invocation).toMatchObject({
        targeting: {
          excludedCreatureTypeIds: [creatureTypeId('UNDEAD'), creatureTypeId('CONSTRUCT')]
        }
      })
  })

  it('keeps the SRD Lay on Hands exactly as authored', async () => {
    const result = await normalize(paladin)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(paladin.features)
  })

  it('keeps a homebrew pool with another size, reset and amount the same way', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
