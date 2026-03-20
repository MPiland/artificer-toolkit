import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const rapier: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(26),
    label: 'Rapier',
    description: 'A thin, elegant dueling blade with finesse.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.FINESSE],
    abilities: [],
    capabilities: S.meleeWeaponCapabilities(S.equipId(26), 'PIERCING', '1d8'),
    cost: S.gp(25),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    modifiers: S.finesseWeaponModifiers(S.equipId(26)),
  userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
