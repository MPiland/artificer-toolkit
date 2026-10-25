import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { net } from '@artificer-toolkit/source-data/srd/equipment/net.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-4.T2m2b: the SRD Net restrains on a hit through one ACTOR_RELATIONSHIP of core options
 * (a size cap, an escape check a rescuer may attempt, and a hold independent of its source), so a
 * Builder author has the same pieces and it must pass the equipment node map exactly as authored.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

async function expectKept(authored: EquipmentAuthored) {
  const result = await normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(authored) as unknown as Record<string, unknown>
  })
  expect(result.clearedPaths).toEqual([])
  expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
}

/** The net's hold, for a variant to change. */
function hold(equipment: EquipmentAuthored) {
  const path = equipment.effects?.[0]?.paths[0]
  const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  if (outcome?.effectKind !== 'ACTOR_RELATIONSHIP')
    throw new Error('The Net must author its hold as a relationship.')
  return outcome
}

describe('the Net’s hold through the equipment node map (SPELLS-4.T2m2b)', () => {
  it('keeps the SRD Net exactly as authored, with no closed rule', async () => {
    expect(JSON.stringify(net.effects)).not.toContain('CLOSED_RULE')
    expect(hold(net).modules.map(({ kind }) => kind)).toEqual([
      'TARGET_SIZE_MAXIMUM',
      'ESCAPE_CHECK',
      'SOURCE_INDEPENDENT_HOLD'
    ])
    await expectKept(net)
  })

  it('keeps a variant net with another escape DC the same way', async () => {
    const variant = structuredClone(net)
    const escape = hold(variant).modules.find(({ kind }) => kind === 'ESCAPE_CHECK')
    if (escape?.kind !== 'ESCAPE_CHECK' || escape.dc.kind !== 'FIXED')
      throw new Error('The Net must author a fixed escape DC.')
    escape.dc.value = 15
    await expectKept(variant)
  })
})
