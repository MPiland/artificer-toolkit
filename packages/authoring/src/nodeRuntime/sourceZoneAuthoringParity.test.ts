import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { blackTentacles } from '@artificer-toolkit/source-data/srd/spells/black-tentacles.js'
import { cloudkill } from '@artificer-toolkit/source-data/srd/spells/cloudkill.js'
import { fireShield } from '@artificer-toolkit/source-data/srd/spells/fire-shield.js'
import { earthquake } from '@artificer-toolkit/source-data/srd/spells/earthquake.js'
import { grease } from '@artificer-toolkit/source-data/srd/spells/grease.js'
import { incendiaryCloud } from '@artificer-toolkit/source-data/srd/spells/incendiary-cloud.js'
import { insectPlague } from '@artificer-toolkit/source-data/srd/spells/insect-plague.js'
import { moonbeam } from '@artificer-toolkit/source-data/srd/spells/moonbeam.js'
import { plantGrowth } from '@artificer-toolkit/source-data/srd/spells/plant-growth.js'
import { sleetStorm } from '@artificer-toolkit/source-data/srd/spells/sleet-storm.js'
import { spiritGuardians } from '@artificer-toolkit/source-data/srd/spells/spirit-guardians.js'
import { wallOfFire } from '@artificer-toolkit/source-data/srd/spells/wall-of-fire.js'
import { wallOfThorns } from '@artificer-toolkit/source-data/srd/spells/wall-of-thorns.js'
import { web } from '@artificer-toolkit/source-data/srd/spells/web.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createNodeRuntimeSourceReader } from './systemSourceRows.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-20 T1b (ADR 0038): the SRD Spirit Guardians aura is authored from the same core options a
 * Builder author has. Its effects are embedded in an equipment record, the one record shape whose node
 * map carries every effect option, and must pass through that map exactly as authored.
 */

const reader = createNodeRuntimeSourceReader({
  coreCodes: dnd5eCoreCodeAdapter.lists,
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

/** Every zone the record's cast places: the one a FIXED path names, or each a cast-time pick offers (D140). */
function auraZones(equipment: EquipmentAuthored) {
  const path = equipment.effects?.[0]?.paths[0]
  const blocks =
    path?.selectionKind === 'FIXED'
      ? [path.resultBlock]
      : path?.selectionKind === 'CHOICE'
        ? path.options.map((option) => option.resultBlock)
        : []
  const zones = blocks.flatMap(({ outcomes }) =>
    outcomes[0]?.effectKind === 'MANIFEST' && outcomes[0].manifestKind === 'ZONE'
      ? [outcomes[0]]
      : []
  )
  if (!zones.length || zones.length !== blocks.length)
    throw new Error('Spirit Guardians must author a zone for every pick.')
  return zones
}

/** The aura the way the Builder authors it with another radius, ability, save DC method and dice. */
function variant(): EquipmentAuthored {
  const equipment = carrying(spiritGuardians.effects as EquipmentAuthored['effects'])
  for (const aura of auraZones(equipment)) {
    const behavior = aura.components?.[0]?.behaviors?.[0]
    if (!behavior || !('savingThrow' in behavior.invocation))
      throw new Error('The aura must author a saving throw.')
    aura.shape = { id: aura.shape!.id, shapeKind: 'SPHERE', radius: { amount: 20, unit: 'FEET' } }
    behavior.invocation.savingThrow = {
      ...behavior.invocation.savingThrow,
      dcMethod: 'FIXED_DC',
      baseDc: 14
    }
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

  it('keeps the choice of unaffected creatures a Builder authors on a zone, which the SRD aura sets the same way', async () => {
    const authored = carrying(spiritGuardians.effects as EquipmentAuthored['effects'])
    for (const aura of auraZones(authored)) {
      expect(aura.components?.[0]?.choosesUnaffected).toBe(true)
      delete aura.components?.[0]?.choosesUnaffected
    }
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
    const withChoice = variant()
    for (const aura of auraZones(withChoice)) {
      const component = aura.components?.[0]
      if (!component) throw new Error('The aura must author a component.')
      component.choosesUnaffected = true
    }
    const kept = await normalize(withChoice)
    expect(kept.clearedPaths).toEqual([])
    expect(getValueAtPath(kept.values, ['effects'])).toEqual(withChoice.effects)
  })

  it.each([
    ['Cloudkill', cloudkill],
    ['Insect Plague', insectPlague],
    ['Moonbeam', moonbeam],
    ['Incendiary Cloud', incendiaryCloud],
    ['Grease', grease],
    ['Sleet Storm', sleetStorm],
    ['Web', web],
    ['Black Tentacles', blackTentacles],
    ['Fire Shield', fireShield],
    ['Wall of Fire', wallOfFire],
    ['Wall of Thorns', wallOfThorns],
    ['Plant Growth', plantGrowth],
    ['Earthquake', earthquake]
  ])(
    'keeps the SRD %s zone exactly as authored (SPELLS-4.T1a, T1b, T1c, T1d, T1e, T2a4, T2q; SPELLS-20.T6d1)',
    async (_name, spell) => {
      const authored = carrying(spell.effects as EquipmentAuthored['effects'])
      const result = await normalize(authored)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
    }
  )

  it('keeps an aura with another radius and a fixed DC the same way, so it resolves like the SRD aura', async () => {
    const authored = variant()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
