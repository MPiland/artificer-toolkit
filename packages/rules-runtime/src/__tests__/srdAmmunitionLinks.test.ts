import { describe, expect, it } from 'vitest'
import { EQUIPMENT_PROPERTY_CODE } from '@artificer-toolkit/shared/core'

import { compiledEquipmentParentIds } from '../character/characterGrantFoldSourceFacts.js'
import { srdRegistry } from '../testing/dnd5eSrdCharacter.js'

const compiled = Object.values(srdRegistry.equipment).filter((item) => item !== undefined)
const labelOf = (id: string) => srdRegistry.equipment[id]?.label

/** The ammunition each SRD ammunition weapon fires, by the weapon's base name. */
const AMMUNITION_BY_WEAPON = {
  Longbow: 'Arrows',
  Shortbow: 'Arrows',
  'Light Crossbow': 'Crossbow Bolts',
  'Heavy Crossbow': 'Crossbow Bolts',
  'Hand Crossbow': 'Crossbow Bolts',
  Sling: 'Sling Bullets',
  Blowgun: 'Blowgun Needles'
} as const

const baseNameOf = (label: string) => label.replace(/ \+\d$/, '')

describe('SRD ammunition weapons name the ammunition they fire (ATTACK-19.4)', () => {
  const weapons = compiled.filter(
    (item) =>
      (item.properties ?? []).includes(EQUIPMENT_PROPERTY_CODE.AMMUNITION) &&
      (item.properties ?? []).includes(EQUIPMENT_PROPERTY_CODE.RANGED)
  )

  it('finds every SRD ammunition weapon', () => {
    expect(new Set(weapons.map(({ label }) => baseNameOf(label ?? '')))).toEqual(
      new Set(Object.keys(AMMUNITION_BY_WEAPON))
    )
  })

  it.each(weapons.map((weapon) => [weapon.label, weapon] as const))(
    'links %s to its ammunition',
    (label, weapon) => {
      const base = baseNameOf(label ?? '') as keyof typeof AMMUNITION_BY_WEAPON
      expect(weapon.ammunitionEquipmentId).toBeDefined()
      expect(labelOf(weapon.ammunitionEquipmentId!)).toBe(AMMUNITION_BY_WEAPON[base])
    }
  )

  it('matches magic ammunition to its weapon through the variant chain, not by name', () => {
    const magicArrows = compiled.find(({ label }) => label === 'Arrows +1')
    if (!magicArrows) throw new Error('Expected the SRD Arrows +1.')
    const arrows = compiled.find(({ label }) => label === 'Arrows')
    expect(compiledEquipmentParentIds(magicArrows)).toContain(arrows?.id)
  })
})
