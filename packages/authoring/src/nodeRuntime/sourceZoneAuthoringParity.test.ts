import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { spiritGuardians } from '@artificer-toolkit/source-data/srd/spells/spirit-guardians.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createNodeRuntimeSourceReader } from './systemSourceRows.js'

/**
 * SPELLS-20 T1b (ADR 0038): the SRD Spirit Guardians aura is authored from the same core options a
 * Builder author has. Its effects are embedded in an equipment record, the one record shape whose node
 * map carries every effect option, and must pass through that map exactly as authored.
 */

const reader = createNodeRuntimeSourceReader({
  system: srdSystemRecord,
  readAuthoredRows: () => [],
  readReusableDefinitions: async () => []
})

function carrying(effects: EquipmentAuthored['effects']): EquipmentAuthored {
  return { ...structuredClone(caltropsBagOf20), effects: structuredClone(effects) }
}

function normalize(equipment: EquipmentAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(equipment) as unknown as Record<string, unknown>
  })
}

/** The aura the way the Builder authors it with another radius, ability, save DC method and dice. */
function variant(): EquipmentAuthored {
  const equipment = carrying(spiritGuardians.effects as EquipmentAuthored['effects'])
  const path = equipment.effects?.[0]?.paths[0]
  const aura = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  if (aura?.effectKind !== 'MANIFEST' || aura.manifestKind !== 'ZONE')
    throw new Error('Spirit Guardians must author a zone.')
  const behavior = aura.components?.[0]?.behaviors?.[0]
  if (!behavior || !('savingThrow' in behavior.invocation))
    throw new Error('The aura must author a saving throw.')
  aura.shape = { id: aura.shape!.id, shapeKind: 'SPHERE', radius: { amount: 20, unit: 'FEET' } }
  behavior.invocation.savingThrow = {
    ...behavior.invocation.savingThrow,
    dcMethod: 'FIXED_DC',
    baseDc: 14
  }
  return equipment
}

describe('the source aura through the equipment node map', () => {
  it('keeps the SRD Spirit Guardians aura exactly as authored', async () => {
    const authored = carrying(spiritGuardians.effects as EquipmentAuthored['effects'])
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it('keeps an aura with another radius and a fixed DC the same way, so it resolves like the SRD aura', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
