import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { equipId } from '../equipment/shared.js'
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

export function applyCreatureEquipmentLoadouts(creature: CreatureAuthored): CreatureAuthored {
  const creatureIndex = Number.parseInt(creature.id.slice(24, 28), 16)
  const bindings = LOADOUT_BINDINGS.filter(([index]) => index === creatureIndex)
  if (bindings.length === 0) return creature

  return {
    ...creature,
    equipmentLoadout: bindings.map(([, featureIndex, equipmentIndex, localIndex]) => ({
      id: S.equipmentLoadoutId(creatureIndex, localIndex),
      equipmentId: equipId(equipmentIndex),
      quantity: 1,
      useState: 'HELD',
      attuned: false,
      actionFeatureIds: [S.featureId(creatureIndex, featureIndex)]
    }))
  }
}
