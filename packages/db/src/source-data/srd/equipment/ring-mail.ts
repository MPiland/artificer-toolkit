import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const ringMail: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(46),
    label: 'Ring Mail',
    description: 'Leather armor with heavy rings sewn into it.',
    category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.HEAVY],
    abilities: [],
    armorClass: 14,
    cost: S.gp(30),
    weight: S.lbs(40),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
