import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const quarterstaff: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(8),
    label: 'Quarterstaff',
    description: 'A sturdy wooden staff usable one- or two-handed.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.SIMPLE, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.VERSATILE],
    abilities: [],
    capabilities: S.meleeVersatileWeaponCapabilities(S.equipId(8), 'BLUDGEONING', '1d6', '1d8'),
    cost: S.gp(0.2),
    weight: S.lbs(4),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
