import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'
import { cp, lbs, sp } from './equipment/shared.js'

const { classes, equipment } = srdBaselineContent.subjects

function item(label: string) {
  const found = equipment.find((entry) => entry.label === label)
  if (!found) throw new Error(`SRD item "${label}" is missing.`)
  if (found.category === 'VARIANT') throw new Error(`SRD item "${label}" is a variant.`)
  return found
}

/** D97: ammunition and Iron Spikes are single pieces, priced and weighed per piece. */
const SINGLE_PIECES = [
  { label: 'Arrows', cost: cp(5), weight: lbs(0.05), bundle: 20 },
  { label: 'Crossbow Bolts', cost: cp(5), weight: lbs(0.075), bundle: 20 },
  { label: 'Blowgun Needles', cost: cp(2), weight: lbs(0.02), bundle: 50 },
  { label: 'Sling Bullets', cost: cp(0.2), weight: lbs(0.075), bundle: 20 },
  { label: 'Iron Spikes', cost: sp(1), weight: lbs(0.5), bundle: 10 }
] as const

describe('SRD item counts (D97)', () => {
  it.each(SINGLE_PIECES)('$label is one piece with a per-piece cost and weight', (piece) => {
    const found = item(piece.label)
    expect(found.label).not.toMatch(/\(\d+\)/)
    expect(found.cost).toEqual(piece.cost)
    expect(found.weight).toEqual(piece.weight)
  })

  it("names the Healer's Kit without its uses and keeps the 10 uses in its charges", () => {
    const kit = item("Healer's Kit")
    expect(kit.charges).toMatchObject({ limitKind: 'FIXED_AMOUNT', amount: 10 })
    expect(equipment.some((entry) => /^Healer's Kit \(/.test(entry.label))).toBe(false)
  })

  it('grants starting ammunition as single pieces, not one bundle', () => {
    const grantedQuantities = (itemLabel: string) =>
      classes.flatMap((characterClass) =>
        ('startingEquipment' in characterClass ? characterClass.startingEquipment.sets : [])
          .flatMap((set) => set.groups)
          .flatMap((group) => group.options)
          .flatMap((option) => option.items)
          .filter(
            (granted) =>
              'equipmentIds' in granted && granted.equipmentIds?.includes(item(itemLabel).id)
          )
          .map((granted) => ('quantity' in granted ? granted.quantity : undefined))
      )

    for (const label of ['Arrows', 'Crossbow Bolts']) {
      const quantities = grantedQuantities(label)
      expect(quantities.length).toBeGreaterThan(0)
      expect(quantities.every((quantity) => quantity === 20)).toBe(true)
    }
    expect(grantedQuantities('Arrows')).toHaveLength(3)
    expect(grantedQuantities('Crossbow Bolts')).toHaveLength(4)
  })
})
