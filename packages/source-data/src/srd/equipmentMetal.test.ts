import { EQUIPMENT_PROPERTY_CODE } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'

/**
 * SPELLS-33 T6i: corrosion (Rust Monster Antennae) hits metal armor, shields and weapons, found by
 * the METAL property. This pins which SRD Equipment carries it, so a new or changed item cannot
 * silently join or leave the set.
 */

const metalLabels = (category: string) =>
  srdBaselineContent.subjects.equipment
    .filter(
      (equipment) =>
        equipment.category === category &&
        equipment.properties?.includes(EQUIPMENT_PROPERTY_CODE.METAL)
    )
    .map(({ label }) => label)
    .sort()

describe('SRD metal Equipment (SPELLS-33 T6i)', () => {
  it('marks the metal armor', () => {
    expect(metalLabels('ARMOR')).toEqual([
      'Breastplate',
      'Chain Mail',
      'Chain Shirt',
      'Half Plate Armor',
      'Plate Armor',
      'Ring Mail',
      'Scale Mail',
      'Splint Armor'
    ])
  })

  it('marks the metal shield', () => {
    expect(metalLabels('SHIELD')).toEqual(['Shield'])
  })

  it('marks the metal weapons', () => {
    expect(metalLabels('WEAPON')).toEqual([
      'Battleaxe',
      'Dagger',
      'Flail',
      'Glaive',
      'Greataxe',
      'Greatsword',
      'Halberd',
      'Handaxe',
      'Iron Golem Sword',
      'Lance',
      'Light Hammer',
      'Longsword',
      'Mace',
      'Maul',
      'Morningstar',
      'Pike',
      'Rapier',
      'Scimitar',
      'Shortsword',
      'Sickle',
      'Spear',
      'Trident',
      'War Pick',
      'Warhammer'
    ])
  })
})
