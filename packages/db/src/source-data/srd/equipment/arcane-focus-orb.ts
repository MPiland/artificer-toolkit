import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const arcaneFocusOrb: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(88),
  label: 'Arcane Focus: Orb',
  description: 'A glass or crystal sphere that channels arcane energy for spellcasting.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(20),
  weight: S.lbs(3),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
