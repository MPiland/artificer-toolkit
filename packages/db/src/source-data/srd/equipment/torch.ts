import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const torch: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(179),
  label: 'Torch',
  description:
    'A wooden stick tipped with oil-soaked cloth that burns for 1 hour, shedding bright light 20 feet.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
  abilities: [],
  cost: S.cp(1),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
