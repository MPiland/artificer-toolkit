import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const studdedLeatherArmor: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(40),
    label: 'Studded Leather Armor',
    description: 'Leather reinforced with close-set rivets of metal.',
    category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.LIGHT],
    abilities: [],
    armorClass: 12,
    cost: S.gp(45),
    weight: S.lbs(13),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
