import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const tinkersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(65),
  label: "Tinker's Tools",
  description:
    'Small tools for repairing and assembling mechanical devices, including screwdrivers and pliers.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(50),
  weight: S.lbs(10),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
