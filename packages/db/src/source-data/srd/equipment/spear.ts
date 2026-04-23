import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const spear: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(10),
    label: 'Spear',
    description: 'A pole with a pointed tip, throwable.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.SIMPLE, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.THROWN, S.EQUIPMENT_PROPERTY_CODE.VERSATILE],
    modifiers: S.thrownWeaponAbilityModifiers(S.equipId(10)),
    effects: S.thrownVersatileWeaponEffects(S.equipId(10), 'PIERCING', '1d6', '1d8', 20),
    cost: S.gp(1),
    weight: S.lbs(3),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }

