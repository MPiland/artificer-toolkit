import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_ACROBATICS_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eVocabularyCapabilityAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/vocabulary'

const reader = createSrdNodeRuntimeReader(dnd5eVocabularyCapabilityAdapter.lists)

/** The effects of an SRD basic action, as the catalogue authors them. */
function catalogueEffects(actionId: string) {
  const definition = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === actionId)
  if (definition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing basic action.')
  return structuredClone(definition.document.effects)
}

/** Equipment authoring the given effects: the effect list a basic action shares with every owner. */
function equipmentWith(effects: unknown): EquipmentAuthored {
  return { ...structuredClone(caltropsBagOf20), effects } as EquipmentAuthored
}

function normalize(equipment: EquipmentAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(equipment) as unknown as Record<string, unknown>
  })
}

describe('the concealment effects through the effect node map (ADR 0038)', () => {
  it.each([
    ['Hide', SRD_BASIC_ACTION_IDS.HIDE],
    ['Search', SRD_BASIC_ACTION_IDS.SEARCH]
  ])('keeps the SRD %s effect exactly as the catalogue authors it', async (_label, actionId) => {
    const authored = equipmentWith(catalogueEffects(actionId))
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it('keeps a variant Hide that checks another skill, so an author builds what the SRD does', async () => {
    const effects = catalogueEffects(SRD_BASIC_ACTION_IDS.HIDE)
    const invocation = effects[0]?.invocation
    if (!invocation || !('check' in invocation) || !invocation.check)
      throw new Error('Hide must author a check.')
    invocation.check.checks = { skillIds: [SRD_ACROBATICS_SKILL_ID], abilityDefinitionIds: [] }
    const authored = equipmentWith(effects)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
