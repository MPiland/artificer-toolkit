import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type {
  CreatureAuthored,
  EquipmentAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { gelatinousCube } from '@artificer-toolkit/source-data/srd/creatures/gelatinous-cube.js'
import { waterElemental } from '@artificer-toolkit/source-data/srd/creatures/water-elemental.js'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { fingerOfDeath } from '@artificer-toolkit/source-data/srd/spells/finger-of-death.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6a2 (D187a): engulfing ships as a GM ruling written from the MANUAL_ADJUDICATION
 * option a Builder author has, beside the authored save and damage. Each subject must pass its
 * node map exactly as authored, and the engulf and Finger of Death zombie closed rule kinds are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

/** Every outcome on one path code of the creature feature's effects. */
function pathOutcomeKinds(creature: CreatureAuthored, label: string, pathCode: string) {
  const feature = creature.features?.find((candidate) => candidate.label === label)
  if (!feature) throw new Error(`The creature must author ${label}.`)
  return (feature.effects ?? []).flatMap((effect) =>
    effect.paths.flatMap((path) =>
      path.selectionKind === 'FIXED' && path.pathCode === pathCode
        ? path.resultBlock.outcomes.map(({ effectKind }) => effectKind)
        : []
    )
  )
}

describe('engulf riders as GM rulings (D187a)', () => {
  it.each([
    { creature: gelatinousCube, label: 'Ooze Cube', pathCode: 'PASSIVE', kinds: [] },
    { creature: gelatinousCube, label: 'Engulf', pathCode: 'ON_SAVE_FAIL', kinds: ['DAMAGE'] },
    { creature: gelatinousCube, label: 'Engulf', pathCode: 'ON_SAVE_SUCCESS', kinds: [] },
    {
      creature: waterElemental,
      label: 'Whelm (Recharge 4-6)',
      pathCode: 'ON_SAVE_FAIL',
      kinds: ['DAMAGE']
    },
    {
      creature: waterElemental,
      label: 'Whelm (Recharge 4-6)',
      pathCode: 'ON_SAVE_SUCCESS',
      kinds: []
    }
  ])(
    'authors the $creature.label $label $pathCode outcomes beside the ruling',
    ({ creature, label, pathCode, kinds }) => {
      expect(pathOutcomeKinds(creature, label, pathCode)).toEqual([...kinds, 'MANUAL_ADJUDICATION'])
    }
  )

  it('authors the Gelatinous Cube Engulf as a DC 12 Dexterity save', () => {
    const engulf = gelatinousCube.features?.find(({ label }) => label === 'Engulf')
    expect(engulf?.effects?.[0]?.invocation).toMatchObject({
      triggerCode: 'SAVING_THROW',
      savingThrow: { dcMethod: 'FIXED_DC', baseDc: 12 }
    })
  })

  it.each([gelatinousCube, waterElemental])(
    'keeps the $label features exactly as authored through the creature node map',
    async (creature) => {
      const result = await normalizeNodeRuntimeValues(reader, {
        mapId: 'creature',
        systemId: srdSystemRecord.id,
        values: structuredClone(creature) as unknown as Record<string, unknown>
      })
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it('keeps the Finger of Death damage automated and the zombie as a ruling, exactly as authored', async () => {
    const failKinds = (fingerOfDeath.effects ?? []).flatMap((effect) =>
      effect.paths.flatMap((path) =>
        path.selectionKind === 'FIXED' && path.pathCode === 'ON_SAVE_FAIL'
          ? path.resultBlock.outcomes.map(({ effectKind }) => effectKind)
          : []
      )
    )
    expect(failKinds).toEqual(['DAMAGE', 'MANUAL_ADJUDICATION'])
    // Equipment authoring the spell's effects: the effect list every owner shares.
    const authored = { ...structuredClone(caltropsBagOf20), effects: fingerOfDeath.effects }
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

  it('no longer lists the engulf and Finger of Death zombie closed rule kinds', () => {
    for (const kind of [
      'CREATURE_GELATINOUS_CUBE_OOZE_CUBE',
      'CREATURE_WATER_ELEMENTAL_WHELM',
      'FINGER_OF_DEATH_ZOMBIE',
      'GELATINOUS_CUBE_ENGULF'
    ]) {
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
    }
  })
})
