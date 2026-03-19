import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const plateArmor: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(49),
    label: 'Plate Armor',
    description: 'Full-body coverage with interlocking metal plates.',
    category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.HEAVY],
    abilities: [],
    armorClass: 18,
    cost: S.gp(1500),
    weight: S.lbs(65),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
