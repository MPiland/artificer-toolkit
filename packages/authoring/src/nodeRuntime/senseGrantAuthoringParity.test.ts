import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { darkvision } from '@artificer-toolkit/source-data/srd/spells/darkvision.js'
import { seeInvisibility } from '@artificer-toolkit/source-data/srd/spells/see-invisibility.js'
import { trueSeeing } from '@artificer-toolkit/source-data/srd/spells/true-seeing.js'
import {
  SRD_SEE_INVISIBILITY_SENSE_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

/** Equipment authoring the given effects: the effect list every owner shares. */
function equipmentWith(effects: unknown): EquipmentAuthored {
  return { ...structuredClone(caltropsBagOf20), effects } as EquipmentAuthored
}

const normalize = (values: EquipmentAuthored) =>
  normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })

describe('See Invisibility as a timed sense grant from core options (SPELLS-4.T2a4, D156)', () => {
  it('keeps the SRD spell, an hour of the See Invisibility sense, exactly as authored', async () => {
    const authored = equipmentWith(seeInvisibility.effects)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it('lets an author grant the sense the way Darkvision grants its own, without a range', async () => {
    const effects = structuredClone(darkvision.effects)
    const path = effects?.[0]?.paths?.[0]
    if (!path || !('resultBlock' in path)) throw new Error('Darkvision has a result block.')
    const outcome = path.resultBlock.outcomes?.[0]
    if (outcome?.effectKind !== 'APPLY_GRANT') throw new Error('Darkvision applies a grant.')
    const sense = outcome.grants.senses?.[0]
    if (!sense || !('senseIds' in sense)) throw new Error('Darkvision grants a sense.')
    Object.assign(sense, {
      senseIds: [SRD_SEE_INVISIBILITY_SENSE_ID],
      range: { id: sense.range.id, rangeKind: 'UNLIMITED' }
    })
    const authored = equipmentWith(effects)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})

describe('True Seeing as a timed sense grant from core options (SPELLS-4.T2a5, D156)', () => {
  it('keeps the SRD spell, an hour of truesight to 120 feet, exactly as authored', async () => {
    const authored = equipmentWith(trueSeeing.effects)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
