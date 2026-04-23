import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const sling: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(14),
    label: 'Sling',
    description: 'A simple ranged weapon that hurls stone or lead bullets.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.SIMPLE, S.EQUIPMENT_PROPERTY_CODE.RANGED, S.EQUIPMENT_PROPERTY_CODE.AMMUNITION],
    modifiers: S.rangedWeaponAbilityModifiers(S.equipId(14)),
    effects: S.rangedWeaponEffects(S.equipId(14), 'BLUDGEONING', '1d4', 30),
    cost: S.gp(0.1),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }

