import { describe, expect, it } from 'vitest'

import type { ClassAuthored, EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { shortsword } from '@artificer-toolkit/source-data/srd/equipment/shortsword.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(mapId: 'equipment' | 'class', values: EquipmentAuthored | ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId,
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

describe('two-weapon fighting through the authoring form (ATTACK-9.5)', () => {
  // A Strength, a finesse and a thrown finesse weapon cover every shape the builders bind.
  it.each([
    ['Club', club],
    ['Shortsword', shortsword],
    ['Dagger', dagger]
  ])(
    'keeps the SRD %s’s bonus-action attack and its split damage modifier exactly as authored',
    async (_label, weapon) => {
      const bonus = weapon.effects?.find(
        ({ invocation }) =>
          invocation.kind === 'ACTION' && invocation.activation?.code === 'BONUS_ACTION'
      )
      // The record under test authors the attack the form must be able to author.
      expect(bonus?.requirements).toBeDefined()
      const result = await normalize('equipment', weapon)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['effects'])).toEqual(weapon.effects)
      expect(getValueAtPath(result.values, ['modifiers'])).toEqual(weapon.modifiers)
    }
  )

  it('keeps the SRD Fighter’s Two-Weapon Fighting style, a core grant, exactly as authored', async () => {
    const style = fighter.features
      ?.find(({ label }) => label === 'Fighting Style')
      ?.options?.find(({ label }) => label === 'Two-Weapon Fighting')
    expect(style?.grants?.modifiers).toHaveLength(2)
    const result = await normalize('class', fighter)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(fighter.features)
  })
})
