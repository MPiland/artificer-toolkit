import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { CREATURE_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { animalShapes } from '@artificer-toolkit/source-data/srd/spells/animal-shapes.js'
import { giantInsect } from '@artificer-toolkit/source-data/srd/spells/giant-insect.js'
import { polymorph } from '@artificer-toolkit/source-data/srd/spells/polymorph.js'
import { shapechange } from '@artificer-toolkit/source-data/srd/spells/shapechange.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

/**
 * Equipment carrying spell effects, so the effect node map is what normalizes them; an item authors them
 * with no grip, as Caltrops does.
 */
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

/** The creature form the way the Builder authors it: another set of forms, with the excess carried over. */
function polymorphShaped(): EquipmentAuthored {
  const equipment = equipmentWith(giantInsect.effects)
  const path = equipment.effects?.[0]?.paths[0]
  const manifest = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  if (manifest?.effectKind !== 'MANIFEST' || manifest.manifestKind !== 'CREATURE')
    throw new Error('Giant Insect must author a creature form.')
  manifest.excessDamageCarriesOver = true
  manifest.forms = [
    {
      id: manifest.forms![0]!.id,
      order: 1,
      label: 'A scorpion',
      creatureId: CREATURE_IDS.GIANT_SCORPION,
      maxTargets: 1
    }
  ]
  return equipment
}

describe('the creature form through the effect node map (ADR 0038)', () => {
  it('keeps the SRD Giant Insect forms exactly as authored', async () => {
    const authored = equipmentWith(giantInsect.effects)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it('keeps the SRD Polymorph form filter exactly as authored, beside no fixed forms', async () => {
    const authored = equipmentWith(polymorph.effects)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  // SPELLS-4.T2s (D191): the form keeps the holder's mental scores; the rest is a GM ruling beside it.
  it.each([
    ['Animal Shapes', animalShapes],
    ['Shapechange', shapechange]
  ])(
    'keeps the SRD %s form, its retained scores and its ruling exactly as authored',
    async (_name, spell) => {
      const authored = equipmentWith(spell.effects)
      const result = await normalize(authored)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
    }
  )

  it('keeps a form that carries excess damage over, so an author builds what the SRD does', async () => {
    const authored = polymorphShaped()
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
