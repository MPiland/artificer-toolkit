import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const chainShirt: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(42),
    label: 'Chain Shirt',
    description: 'A shirt of interlocking metal rings.',
    category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MEDIUM],
    armorClass: 13,
    cost: S.gp(50),
    weight: S.lbs(20),
    rarityId: S.RARITY_COMMON,
    modifiers: S.mediumArmorModifiers(S.equipId(42)),
  userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
