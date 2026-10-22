import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { silentImage } from '@artificer-toolkit/source-data/srd/spells/silent-image.js'
import { teleport } from '@artificer-toolkit/source-data/srd/spells/teleport.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

describe('a spell whose core-option outcome keeps a GM ruling beside it (SPELLS-4.T2a5, D156)', () => {
  it.each([
    ['Silent Image', silentImage],
    ['Teleport', teleport]
  ])('keeps the SRD %s effect exactly as authored', async (_name, spell) => {
    // Equipment authoring the spell's effects: the effect list every owner shares.
    const authored = { ...structuredClone(caltropsBagOf20), effects: spell.effects }
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'equipment',
      systemId: srdSystemRecord.id,
      values: structuredClone(authored) as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(
      (authored as EquipmentAuthored).effects
    )
  })
})
