import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const leatherworkersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(60),
  label: "Leatherworker's Tools",
  description: 'Knives, punches, and dyes for cutting and stitching leather into goods.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(5),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
