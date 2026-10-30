import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

/** The Shove effects, as the catalogue authors them. */
function shoveEffects() {
  const definition = SRD_BASIC_ACTION_DEFINITIONS.find(
    ({ id }) => id === SRD_BASIC_ACTION_IDS.SHOVE
  )
  if (definition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Shove.')
  return structuredClone(definition.document.effects)
}

/** Equipment authoring the given effects: the effect list a basic action shares with every owner. */
function equipmentWith(effects: unknown): EquipmentAuthored {
  return { ...structuredClone(caltropsBagOf20), effects } as EquipmentAuthored
}

async function expectKept(effects: unknown) {
  const authored = equipmentWith(effects)
  const result = await normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(authored) as unknown as Record<string, unknown>
  })
  expect(result.clearedPaths).toEqual([])
  expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
}

describe('a contest whose win is a picked outcome, through the effect node map (ADR 0038, D105)', () => {
  it('keeps the SRD Shove effect exactly as the catalogue authors it', async () => {
    await expectKept(shoveEffects())
  })

  it('keeps a variant Shove that pushes 10 feet, so an author builds what the SRD does', async () => {
    const effects = shoveEffects()
    const win = effects[0]?.paths[0]
    if (win?.selectionKind !== 'CHOICE') throw new Error('Shove must author its pick.')
    const push = win.options[1]?.resultBlock.outcomes[0]
    if (push?.effectKind !== 'FORCED_MOVEMENT' || push.distanceMode !== 'EXACT')
      throw new Error('Shove must author its push.')
    push.amount = 10
    await expectKept(effects)
  })

  it("keeps an option's influence on the initiator's check, from the System's roll influences", async () => {
    const effects = shoveEffects()
    const win = effects[0]?.paths[0]
    if (win?.selectionKind !== 'CHOICE') throw new Error('Shove must author its pick.')
    const [prone, push] = win.options
    if (!prone || !push) throw new Error('Shove must author two options.')
    prone.initiatorCheckInfluence = 'ADVANTAGE'
    push.initiatorCheckInfluence = 'DISADVANTAGE'
    await expectKept(effects)
  })
})
