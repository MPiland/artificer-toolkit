import { VALUE_DOMAIN_CODE } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'
import { srdEquipment } from './equipment/index.js'
import { srdVehicles } from './vehicles/index.js'

type Node = Record<string, unknown>

/**
 * The utility equipment and vehicle rules that change no resolved state: no spell component or focus
 * use is enforced, and none touches HP, conditions, attacks, saves, checks, movement, zones,
 * resources or Sheet values, so the description is the whole rule (D156, D217, SPELLS-4.T4a).
 */
const DESCRIPTION_ONLY_EQUIPMENT = [
  'Magnifying Glass',
  'Tinderbox',
  'Rope (50 ft, hempen)',
  'Rope (50 ft, silk)',
  'Chain (10 feet)',
  'Arcane Focus: Crystal',
  'Arcane Focus: Orb',
  'Arcane Focus: Rod',
  'Arcane Focus: Staff',
  'Arcane Focus: Wand',
  'Druidic Focus: Sprig of Mistletoe',
  'Druidic Focus: Totem',
  'Druidic Focus: Wooden Staff',
  'Druidic Focus: Yew Wand',
  'Holy Symbol: Amulet',
  'Holy Symbol: Emblem',
  'Holy Symbol: Reliquary',
  'Component Pouch'
]

/** Heavy armor whose Strength rule is already the authored speed penalty. */
const HEAVY_ARMOR = ['Chain Mail', 'Splint Armor', 'Plate Armor']

const VEHICLE_RULE_FEATURES = ['Mounts and Vehicles', 'Rowed Vessels']

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

/** Every node below `value` (inclusive) that satisfies `match`, depth first. */
function nodesWhere(value: unknown, match: (node: Node) => boolean): Node[] {
  if (Array.isArray(value)) return value.flatMap((entry) => nodesWhere(entry, match))
  if (!isNode(value)) return []
  const own = match(value) ? [value] : []
  return [...own, ...Object.values(value).flatMap((entry) => nodesWhere(entry, match))]
}

const closedRules = (value: unknown) =>
  nodesWhere(value, (node) => node.effectKind === 'CLOSED_RULE')

const equipmentLabelled = (label: string) => {
  const item = srdEquipment.find((entry) => entry.label === label)
  if (!item) throw new Error(`${label} is not in the SRD equipment`)
  return item
}

describe('description-only SRD equipment and vehicle rules (D156, SPELLS-4.T4a)', () => {
  it.each(DESCRIPTION_ONLY_EQUIPMENT)('%s keeps its description and no closed rule', (label) => {
    const item = equipmentLabelled(label)
    expect(closedRules(item)).toEqual([])
    expect(String(item.description ?? '').trim().length).toBeGreaterThan(0)
  })

  it.each(HEAVY_ARMOR)('%s has no closed rule and authors its speed penalty', (label) => {
    const armor = equipmentLabelled(label)
    expect(closedRules(armor)).toEqual([])
    expect(
      (armor.modifiers ?? []).some(
        (modifier) => modifier.valueDomainCode === VALUE_DOMAIN_CODE.SPEED
      )
    ).toBe(true)
  })

  it.each(VEHICLE_RULE_FEATURES)('the %s vehicle rule is description-only', (label) => {
    const features = nodesWhere(srdVehicles, (node) => node.label === label)
    expect(features.length).toBeGreaterThan(0)
    for (const feature of features) {
      expect(closedRules(feature)).toEqual([])
      expect(String(feature.description ?? '').trim().length).toBeGreaterThan(0)
    }
  })
})
