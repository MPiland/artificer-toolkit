import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const scaleMail: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(43),
    label: 'Scale Mail',
    description: 'A coat of leather covered with overlapping metal scales.',
    category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MEDIUM],
    abilities: [],
    armorClass: 14,
    cost: S.gp(50),
    weight: S.lbs(45),
    rarityId: S.RARITY_COMMON,
    modifiers: S.mediumArmorModifiers(S.equipId(43)),
  userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
