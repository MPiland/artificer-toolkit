import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { CREATURE_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { findFamiliar } from '@artificer-toolkit/source-data/srd/spells/find-familiar.js'
import { creatureTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

/** Equipment carrying spell effects, so the effect node map is what normalizes them. */
function equipmentWith(effects: SpellAuthored['effects']): EquipmentAuthored {
  return {
    ...structuredClone(caltropsBagOf20),
    effects: structuredClone(effects)?.map((effect) => ({ ...effect, grip: null }))
  }
}

function normalize(equipment: EquipmentAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(equipment) as unknown as Record<string, unknown>
  })
}

/** A homebrew companion: one other System Creature, always of one Creature Type. */
function homebrewCompanion(): EquipmentAuthored {
  const equipment = equipmentWith(findFamiliar.effects)
  const path = equipment.effects?.[0]?.paths[0]
  const summon = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  if (summon?.effectKind !== 'MANIFEST' || summon.manifestKind !== 'SUMMON')
    throw new Error('Find Familiar must author a summon.')
  summon.forms = [
    {
      id: summon.forms![0]!.id,
      order: 1,
      label: 'A wolf',
      creatureId: CREATURE_IDS.WOLF,
      maxTargets: 1
    }
  ]
  summon.creatureTypeIds = [creatureTypeId('FEY')]
  return equipment
}

describe('a summon of System Creature forms through the effect node map (SPELLS-34.T3a)', () => {
  it('keeps the SRD Find Familiar forms and Creature Types exactly as authored', async () => {
    const authored = equipmentWith(findFamiliar.effects)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it('keeps a homebrew companion of other forms and one Creature Type, so an author builds what the SRD does', async () => {
    const authored = homebrewCompanion()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
