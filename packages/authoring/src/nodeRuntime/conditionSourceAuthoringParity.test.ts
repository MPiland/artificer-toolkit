import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { adultRedDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-red-dragon.js'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { fear } from '@artificer-toolkit/source-data/srd/spells/fear.js'
import { SRD_CONDITION_TYPES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createNodeRuntimeSourceReader } from './systemSourceRows.js'

const reader = createNodeRuntimeSourceReader({
  system: srdSystemRecord,
  readAuthoredRows: () => [],
  readReusableDefinitions: async () => []
})

/** Every CONDITION outcome the value nests, wherever it sits. */
function conditionOutcomes(value: unknown): Record<string, unknown>[] {
  if (typeof value !== 'object' || value === null) return []
  const own =
    'effectKind' in value && value.effectKind === 'CONDITION'
      ? [value as Record<string, unknown>]
      : []
  return [...own, ...Object.values(value).flatMap(conditionOutcomes)]
}

/** Equipment authoring the given effects: the effect list every owner shares. */
function equipmentWith(effects: unknown): EquipmentAuthored {
  return { ...structuredClone(caltropsBagOf20), effects } as EquipmentAuthored
}

function normalize(mapId: 'equipment' | 'creature', values: unknown) {
  return normalizeNodeRuntimeValues(reader, {
    mapId,
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as Record<string, unknown>
  })
}

describe('a condition that records its source through the effect node map (SPELLS-29, ADR 0038)', () => {
  it('keeps the SRD Fear effect, whose Frightened records its caster, exactly as authored', async () => {
    expect(conditionOutcomes(fear.effects).map((outcome) => outcome.recordsSource)).toEqual([true])
    const authored = equipmentWith(fear.effects)
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(result.values.effects).toEqual(authored.effects)
  })

  it("keeps a dragon's Frightful Presence recording the dragon", async () => {
    expect(conditionOutcomes(adultRedDragon).map((outcome) => outcome.recordsSource)).toEqual([
      true
    ])
    const result = await normalize('creature', adultRedDragon)
    expect(result.clearedPaths).toEqual([])
    expect(conditionOutcomes(result.values).map((outcome) => outcome.recordsSource)).toEqual([true])
  })

  it('lets an author record the source of any condition, so a homebrew fear builds what the SRD does', async () => {
    const poisoned = SRD_CONDITION_TYPES.find((entry) => entry.code === 'POISONED')
    if (!poisoned) throw new Error('Missing Poisoned.')
    const effects = structuredClone(fear.effects)
    for (const outcome of conditionOutcomes(effects))
      Object.assign(outcome, { conditionId: poisoned.id, recordsSource: true })
    const authored = equipmentWith(effects)
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(result.values.effects).toEqual(authored.effects)
  })
})
