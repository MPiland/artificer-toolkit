import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const tinderbox: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(178),
  label: 'Tinderbox',
  description:
    'This small container holds flint, fire steel, and tinder (usually dry cloth soaked in light oil) used to kindle a fire. Using it to light a torch-or anything else with abundant, exposed fuel-takes an action. Lighting any other fire takes 1 minute.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.sp(5),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
