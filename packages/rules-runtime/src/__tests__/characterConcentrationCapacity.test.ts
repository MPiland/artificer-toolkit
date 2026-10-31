import { describe, expect, it } from 'vitest'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  equipId,
  magicArmorModifiers
} from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { signetRing } from '@artificer-toolkit/source-data/srd/equipment/signet-ring.js'

import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'

/** A worn item whose authored modifier adds `bonus` to how many Concentrations its holder keeps. */
const capacityItem = (number: number, label: string, bonus: number): EquipmentAuthored => ({
  ...signetRing,
  id: equipId(number),
  label,
  modifiers: magicArmorModifiers(equipId(number), bonus).map((modifier) => ({
    ...modifier,
    valueDomainCode: 'CONCENTRATION_CAPACITY' as const,
    domain: {}
  }))
})

const firstItem = capacityItem(910, 'Capacity Item One', 1)
const secondItem = capacityItem(911, 'Capacity Item Two', 1)

/** The Concentrations the installed D&D policy lets an SRD Wizard keep at once. */
function concentrationCapacity(items: readonly { label: string; equipped: boolean }[]) {
  return evaluateSrdCharacter({
    classes: [{ label: 'Wizard', level: 5 }],
    items,
    extraEquipment: [firstItem, secondItem]
  }).output.concentrationCapacity
}

describe('Concentration capacity', () => {
  it('is one for a Character with no capacity modifier', () => {
    expect(concentrationCapacity([])).toBe(1)
  })

  it('grows by the authored bonus of an item only while it is equipped', () => {
    expect(concentrationCapacity([{ label: firstItem.label, equipped: true }])).toBe(2)
    expect(concentrationCapacity([{ label: firstItem.label, equipped: false }])).toBe(1)
  })

  it('adds the bonuses of every source', () => {
    expect(
      concentrationCapacity([
        { label: firstItem.label, equipped: true },
        { label: secondItem.label, equipped: true }
      ])
    ).toBe(3)
  })
})
