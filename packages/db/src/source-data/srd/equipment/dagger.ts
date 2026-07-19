import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const dagger: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(2),
    label: 'Dagger',
    description: 'A small blade for quick strikes.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.SIMPLE, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.FINESSE, S.EQUIPMENT_PROPERTY_CODE.LIGHT, S.EQUIPMENT_PROPERTY_CODE.THROWN],
    effects: S.thrownWeaponEffects(S.equipId(2), 'PIERCING', '1d4', 20),
    cost: S.gp(2),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    modifiers: S.finesseWeaponWithRangedModifiers(S.equipId(2)),
  userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }

