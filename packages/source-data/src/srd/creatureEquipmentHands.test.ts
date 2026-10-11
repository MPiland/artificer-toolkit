import { EQUIPMENT_PROPERTY_CODE, resolveHandOccupancy } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'

const equipmentById = new Map(
  srdBaselineContent.subjects.equipment.map((equipment) => [equipment.id, equipment])
)
const loadouts = srdBaselineContent.subjects.creatures.flatMap((creature) =>
  creature.equipmentLoadout?.length ? [{ creature, loadout: creature.equipmentLoadout }] : []
)

function slotOf(creatureLabel: string, equipmentLabel: string) {
  const entry = loadouts
    .find(({ creature }) => creature.label === creatureLabel)
    ?.loadout.find((item) => equipmentById.get(item.equipmentId)?.label === equipmentLabel)
  if (!entry) throw new Error(`${creatureLabel} has no ${equipmentLabel} in its loadout.`)
  return entry.useState
}

describe('SRD Creature equipment hands', () => {
  it('places every SRD Creature loadout without a hand conflict', () => {
    const conflicts = loadouts.flatMap(({ creature, loadout }) => {
      const occupancy = resolveHandOccupancy(
        loadout.map((entry) => {
          const equipment = equipmentById.get(entry.equipmentId)
          if (!equipment) throw new Error(`${creature.label} binds missing Equipment.`)
          return {
            id: entry.id,
            slot: entry.useState,
            twoHanded: equipment.properties?.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED) === true
          }
        })
      )
      return occupancy.conflicts.map(({ code }) => `${creature.label}: ${code}`)
    })
    expect(conflicts).toEqual([])
  })

  it('holds the first melee weapon and carries a two-handed bow', () => {
    expect(slotOf('Goblin', 'Scimitar')).toBe('MAIN_HAND')
    expect(slotOf('Goblin', 'Shortbow')).toBe('CARRIED')
    expect(slotOf('Ogre', 'Greatclub')).toBe('MAIN_HAND')
  })

  it('puts a second one-handed weapon in the off hand', () => {
    expect(slotOf('Archmage', 'Dagger')).toBe('MAIN_HAND')
    const offHand = loadouts.filter(({ loadout }) =>
      loadout.some((entry) => entry.useState === 'OFF_HAND')
    )
    expect(offHand.length).toBeGreaterThan(0)
  })
})
