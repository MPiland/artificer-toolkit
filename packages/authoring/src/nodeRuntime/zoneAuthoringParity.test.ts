import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createNodeRuntimeSourceReader } from './systemSourceRows.js'

const reader = createNodeRuntimeSourceReader({
  system: srdSystemRecord,
  readAuthoredRows: () => [],
  readReusableDefinitions: async () => []
})

function normalize(equipment: EquipmentAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(equipment) as unknown as Record<string, unknown>
  })
}

/** The record the way the Builder authors it with another save DC and a circle for the field. */
function variant(): EquipmentAuthored {
  const equipment = structuredClone(caltropsBagOf20)
  const outcome = equipment.effects?.[0]?.paths[0]
  const zone = outcome?.selectionKind === 'FIXED' ? outcome.resultBlock.outcomes[0] : undefined
  if (zone?.effectKind !== 'MANIFEST' || zone.manifestKind !== 'ZONE')
    throw new Error('Caltrops must author a zone.')
  const invocation = zone.components?.[0]?.behaviors?.[0]?.invocation
  if (!invocation || !('savingThrow' in invocation))
    throw new Error('The zone must author a saving throw.')
  zone.shape = { id: zone.shape.id, shapeKind: 'CIRCLE', radius: { amount: 10, unit: 'FEET' } }
  invocation.savingThrow = { ...invocation.savingThrow, baseDc: 13 }
  return equipment
}

describe('the zone shape through the equipment node map', () => {
  it('keeps the SRD Caltrops zone exactly as authored', async () => {
    const result = await normalize(caltropsBagOf20)
    expect(result.clearedPaths).toEqual([])
    expect(result.values.effects).toEqual(caltropsBagOf20.effects)
  })

  it('keeps a zone with another DC and a circle the same way, so it resolves like the SRD shape', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(result.values.effects).toEqual(authored.effects)
  })
})
