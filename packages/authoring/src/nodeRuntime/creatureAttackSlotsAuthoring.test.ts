import { describe, expect, it } from 'vitest'

import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * ATTACK-11.3: a Multiattack's slot set is authored through the Creature editor's node map, so the
 * SRD Brown Bear and a homebrew Creature hold the same set exactly as authored.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const features = brownBear.features ?? []
const multiattackIndex = features.findIndex((feature) => feature.label === 'Multiattack')
const bite = features.find((feature) => feature.label === 'Bite')
if (multiattackIndex < 0 || !bite) throw new Error('Expected the Brown Bear actions.')

function normalizeCreature(values: object) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as Record<string, unknown>
  })
}

function withMultiattackSlots(attackSlots: unknown) {
  const edited = [...features]
  edited[multiattackIndex] = {
    ...features[multiattackIndex]!,
    attackSlots
  } as (typeof features)[number]
  return normalizeCreature({ ...brownBear, features: edited })
}

const slotPath = ['features', multiattackIndex, 'attackSlots', 'alternatives', 0, 'slots', 0]

describe('Multiattack slot set authoring', () => {
  it("keeps the Brown Bear's slot set exactly as authored", async () => {
    const result = await normalizeCreature(brownBear)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(brownBear.features)
  })

  it('clears an action reference once the slot is filled by any attack', async () => {
    const result = await withMultiattackSlots({
      alternatives: [
        { slots: [{ count: 1, fillers: [{ kind: 'ANY_ATTACK', featureId: bite.id }] }] }
      ]
    })
    expect(result.clearedPaths).toEqual([[...slotPath, 'fillers', 0, 'featureId']])
  })

  it('clears a size once the condition is not a size limit', async () => {
    const result = await withMultiattackSlots({
      alternatives: [
        {
          slots: [
            {
              count: 1,
              fillers: [{ kind: 'ANY_ATTACK' }],
              condition: { kind: 'EARLIER_SLOTS_HIT_SAME_TARGET', size: 'MEDIUM' }
            }
          ]
        }
      ]
    })
    expect(result.clearedPaths).toEqual([[...slotPath, 'condition', 'size']])
  })
})
