import { describe, expect, it } from 'vitest'

import { dnd5eConcentrationCapacityForCast } from '../systems/dnd5e/concentrationCapacity.js'
import { concentrationCapacityItem } from '../testing/concentrationCapacityItem.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'

const capacityItem = (number: number, label: string, bonus: number) =>
  concentrationCapacityItem({ number, label, bonus })
const firstItem = capacityItem(910, 'Capacity Item One', 1)
const secondItem = capacityItem(911, 'Capacity Item Two', 1)
const gatedItem = concentrationCapacityItem({
  number: 912,
  label: 'Gated Capacity Item',
  bonus: 1,
  maxSpellLevel: 3
})
const usesItem = concentrationCapacityItem({
  number: 913,
  label: 'Limited Capacity Item',
  bonus: 1,
  uses: 1
})

/** The installed D&D policy's output for an SRD Wizard wearing the named items. */
function wizardPolicy(items: readonly { label: string; equipped: boolean }[]) {
  return evaluateSrdCharacter({
    classes: [{ label: 'Wizard', level: 5 }],
    items,
    extraEquipment: [firstItem, secondItem, gatedItem, usesItem],
    resourceUsage: []
  }).output
}

const concentrationCapacity = (items: readonly { label: string; equipped: boolean }[]) =>
  wizardPolicy(items).concentrationCapacity

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

  describe('with a bonus gated by a spell level', () => {
    const policyOutput = wizardPolicy([{ label: gatedItem.label, equipped: true }])
    const capacityFor = (newLevel: number | null, heldSpellLevels: (number | null)[]) =>
      dnd5eConcentrationCapacityForCast({
        policyOutput,
        newSpell: { id: 'new-spell', level: newLevel },
        heldSpellLevels,
        usesAvailable: true
      }).capacity

    it('is left out of the Character-wide capacity and listed as gated', () => {
      expect(policyOutput.concentrationCapacity).toBe(1)
      expect(policyOutput.gatedConcentrationCapacity).toHaveLength(1)
    })

    it('counts for a cast when the new spell and every held one meet the limit', () => {
      expect(capacityFor(3, [])).toBe(2)
      expect(capacityFor(3, [1])).toBe(2)
      expect(capacityFor(0, [3, 2])).toBe(2)
    })

    it('does not count when the new spell is above the limit', () => {
      expect(capacityFor(4, [1])).toBe(1)
    })

    it('does not count when a held Concentration is above the limit or has no spell', () => {
      expect(capacityFor(1, [4])).toBe(1)
      expect(capacityFor(1, [3, null])).toBe(1)
    })

    it('does not count for a cast that is not a spell', () => {
      expect(capacityFor(null, [])).toBe(1)
    })

    it('does not count while the item is not equipped', () => {
      expect(
        dnd5eConcentrationCapacityForCast({
          policyOutput: wizardPolicy([{ label: gatedItem.label, equipped: false }]),
          newSpell: { id: 'new-spell', level: 1 },
          heldSpellLevels: [1],
          usesAvailable: true
        }).capacity
      ).toBe(1)
    })
  })

  describe('with a bonus that spends a use of an item charge', () => {
    const policyOutput = wizardPolicy([{ label: usesItem.label, equipped: true }])
    const castWith = (heldSpellLevels: (number | null)[], usesAvailable = true) =>
      dnd5eConcentrationCapacityForCast({
        policyOutput,
        newSpell: { id: 'new-spell', level: 1 },
        heldSpellLevels,
        usesAvailable
      })

    it('is left out of the Character-wide capacity and listed with its charge', () => {
      expect(policyOutput.concentrationCapacity).toBe(1)
      expect(policyOutput.gatedConcentrationCapacity).toEqual([
        expect.objectContaining({ chargeId: expect.any(String) })
      ])
    })

    it('spends nothing while the holder keeps fewer than the base capacity', () => {
      expect(castWith([])).toEqual({ capacity: 1, use: null })
    })

    it('makes room for one more and names the pool to spend once the base capacity is held', () => {
      expect(castWith([1])).toEqual({
        capacity: 2,
        use: { poolId: expect.any(String), chargeId: expect.any(String) }
      })
    })

    it('makes no room when the cast cannot pay a use', () => {
      expect(castWith([1], false)).toEqual({ capacity: 1, use: null })
    })

    it('makes no room once the item has no use left', () => {
      const spent = {
        ...policyOutput,
        resources: policyOutput.resources.map((resource) =>
          resource.chargeId === policyOutput.gatedConcentrationCapacity[0]?.chargeId
            ? { ...resource, remaining: 0 }
            : resource
        )
      }
      expect(
        dnd5eConcentrationCapacityForCast({
          policyOutput: spent,
          newSpell: { id: 'new-spell', level: 1 },
          heldSpellLevels: [1],
          usesAvailable: true
        })
      ).toEqual({ capacity: 1, use: null })
    })
  })
})
