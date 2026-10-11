import type {
  CreatureAuthored,
  EquipmentAuthored,
  EquipmentPropertyCode,
  EquipmentSlotCode
} from '@artificer-toolkit/shared'
import { srdEquipment } from '../equipment/index.js'
import { EQUIPMENT_CATEGORY_CODE, EQUIPMENT_PROPERTY_CODE, equipId } from '../equipment/shared.js'
import * as S from './shared.js'

type LoadoutBinding = readonly [
  creatureIndex: number,
  featureIndex: number,
  equipmentIndex: number,
  localIndex: number
]

/**
 * Exact authored Creature equipment bindings. The numeric indexes are the
 * source IDs already used by each Creature/Feature, never labels parsed at
 * runtime. A Creature action binds to the one held item it mechanically uses.
 */
const LOADOUT_BINDINGS: readonly LoadoutBinding[] = [
  [2, 3, 1, 1],
  [28, 4, 2, 1],
  [29, 6, 28, 1],
  [29, 7, 11, 2],
  [33, 4, 31, 1],
  [36, 6, 22, 1],
  [36, 7, 32, 2],
  [37, 2, 27, 1],
  [37, 3, 11, 2],
  [38, 2, 27, 1],
  [38, 3, 2, 2],
  [42, 6, 17, 1],
  [44, 3, 18, 1],
  [56, 3, 24, 1],
  [56, 4, 5, 2],
  [60, 3, 25, 1],
  [60, 5, 36, 2],
  [66, 4, 24, 1],
  [68, 2, 1, 1],
  [74, 5, 2, 1],
  [75, 3, 27, 1],
  [78, 4, 30, 1],
  [80, 5, 7, 1],
  [82, 4, 27, 1],
  [87, 8, 22, 1],
  [87, 9, 36, 2],
  [88, 4, 28, 1],
  [88, 5, 34, 2],
  [89, 2, 8, 1],
  [90, 5, 1, 1],
  [91, 4, 30, 1],
  [91, 5, 5, 2],
  [95, 4, 27, 1],
  [98, 5, 22, 1],
  [98, 6, 36, 2],
  [100, 5, 24, 1],
  [102, 2, 19, 1],
  [146, 2, 27, 1],
  [146, 3, 13, 2],
  [155, 2, 10, 1],
  [158, 3, 28, 1],
  [158, 4, 35, 2],
  [163, 2, 3, 1],
  [165, 2, 22, 1],
  [165, 3, 36, 2],
  [178, 3, 19, 1],
  [178, 4, 35, 2],
  [179, 3, 2, 1],
  [181, 4, 2, 1],
  [186, 4, 381, 1],
  [186, 5, 5, 2],
  [186, 6, 382, 3],
  [187, 3, 2, 1],
  [192, 6, 22, 1],
  [194, 4, 28, 1],
  [194, 5, 36, 2],
  [195, 2, 10, 1],
  [198, 4, 18, 1],
  [199, 3, 18, 1],
  [206, 1, 26, 1],
  [209, 1, 3, 1],
  [209, 2, 5, 2],
  [210, 3, 24, 1],
  [212, 2, 18, 1],
  [212, 3, 5, 2],
  [219, 9, 7, 1],
  [220, 8, 19, 1],
  [225, 3, 7, 1],
  [243, 7, 10, 1],
  [245, 3, 28, 1],
  [245, 4, 13, 2],
  [247, 4, 28, 1],
  [247, 5, 36, 2],
  [255, 2, 28, 1],
  [255, 3, 13, 2],
  [256, 4, 19, 1],
  [256, 5, 36, 2],
  [260, 3, 13, 1],
  [260, 4, 22, 2],
  [261, 5, 28, 1],
  [261, 6, 34, 2],
  [264, 2, 3, 1],
  [266, 4, 19, 1],
  [266, 5, 384, 2],
  [272, 3, 10, 1],
  [279, 3, 22, 1],
  [279, 4, 28, 2],
  [279, 5, 35, 3],
  [288, 5, 23, 1],
  [293, 4, 22, 1],
  [293, 5, 36, 2],
  [154, 4, 380, 1],
  [175, 8, 383, 1]
]

type WornGearBinding = readonly [
  creatureIndex: number,
  armorEquipmentIndex: number | null,
  shieldEquipmentIndex: number | null
]

/**
 * The armor a Creature wears and the shield it holds, from the printed armor class note ("studded
 * leather, shield"). Both are armor class sources with no action Features: the computed armor class
 * reads them, and the shield takes the off hand. Armor the SRD Equipment does not have ("armor
 * scraps", "patchwork armor") is natural armor, and a conditional armor class ("15 with mage armor")
 * authors only its base value.
 */
const WORN_GEAR_BINDINGS: readonly WornGearBinding[] = [
  [29, 40, null],
  [33, null, 50],
  [37, 39, null],
  [38, 40, null],
  [44, 41, null],
  [56, 41, 50],
  [74, 39, null],
  [75, 39, null],
  [78, 42, null],
  [88, 42, null],
  [91, 43, 50],
  [98, 49, null],
  [102, 49, null],
  [143, 40, 50],
  [144, 41, 50],
  [146, 39, 50],
  [155, 42, 50],
  [158, 49, null],
  [165, 47, 50],
  [178, 49, null],
  [186, null, 50],
  [206, 44, null],
  [209, 41, null],
  [211, 47, null],
  [212, 41, null],
  [225, 42, null],
  [245, 39, null],
  [247, 39, null],
  [260, 39, null],
  [266, 43, null],
  [269, 39, null],
  [272, 41, null],
  [279, 48, null],
  [293, 40, null]
]

const WORN_ARMOR_LOCAL_INDEX = 20
const HELD_SHIELD_LOCAL_INDEX = 21

const EQUIPMENT_BY_ID = new Map(srdEquipment.map((equipment) => [equipment.id, equipment]))

function boundEquipment(equipmentIndex: number) {
  const equipment = EQUIPMENT_BY_ID.get(equipId(equipmentIndex))
  if (!equipment) throw new Error(`Creature loadout binds missing Equipment ${equipmentIndex}.`)
  return equipment
}

/**
 * Deterministic hand assignment for one Creature's bound items: weapons are ordered melee first
 * (binding order within each group); the first takes the main hand, the next one-handed weapon
 * takes the off hand unless the main hand is two-handed or a shield holds it, and everything else
 * is carried.
 */
function assignSlots(
  items: readonly EquipmentAuthored[],
  shieldHeld: boolean
): EquipmentSlotCode[] {
  const has = (item: EquipmentAuthored, property: EquipmentPropertyCode) =>
    item.properties?.includes(property) === true
  const weapons = items.flatMap((item, index) =>
    item.category === EQUIPMENT_CATEGORY_CODE.WEAPON ? [{ item, index }] : []
  )
  const [main, ...rest] = [
    ...weapons.filter(({ item }) => !has(item, EQUIPMENT_PROPERTY_CODE.RANGED)),
    ...weapons.filter(({ item }) => has(item, EQUIPMENT_PROPERTY_CODE.RANGED))
  ]
  const slots = items.map((): EquipmentSlotCode => 'CARRIED')
  if (!main) return slots
  slots[main.index] = 'MAIN_HAND'
  if (shieldHeld || has(main.item, EQUIPMENT_PROPERTY_CODE.TWO_HANDED)) return slots
  const off = rest.find(({ item }) => !has(item, EQUIPMENT_PROPERTY_CODE.TWO_HANDED))
  if (off) slots[off.index] = 'OFF_HAND'
  return slots
}

export function applyCreatureEquipmentLoadouts(creature: CreatureAuthored): CreatureAuthored {
  const creatureIndex = Number.parseInt(creature.id.slice(24, 28), 16)
  const bindings = LOADOUT_BINDINGS.filter(([index]) => index === creatureIndex)
  const [, armorIndex = null, shieldIndex = null] =
    WORN_GEAR_BINDINGS.find(([index]) => index === creatureIndex) ?? []
  if (bindings.length === 0 && armorIndex === null && shieldIndex === null) return creature

  const slots = assignSlots(
    bindings.map(([, , equipmentIndex]) => boundEquipment(equipmentIndex)),
    shieldIndex !== null
  )
  const gearEntry = (localIndex: number, equipmentIndex: number, useState: EquipmentSlotCode) => ({
    id: S.equipmentLoadoutId(creatureIndex, localIndex),
    equipmentId: boundEquipment(equipmentIndex).id,
    quantity: 1,
    useState,
    attuned: false,
    actionFeatureIds: []
  })
  return {
    ...creature,
    equipmentLoadout: [
      ...bindings.map(([, featureIndex, equipmentIndex, localIndex], index) => ({
        id: S.equipmentLoadoutId(creatureIndex, localIndex),
        equipmentId: equipId(equipmentIndex),
        quantity: 1,
        useState: slots[index]!,
        attuned: false,
        actionFeatureIds: [S.featureId(creatureIndex, featureIndex)]
      })),
      ...(armorIndex === null ? [] : [gearEntry(WORN_ARMOR_LOCAL_INDEX, armorIndex, 'WORN')]),
      ...(shieldIndex === null ? [] : [gearEntry(HELD_SHIELD_LOCAL_INDEX, shieldIndex, 'OFF_HAND')])
    ]
  }
}
