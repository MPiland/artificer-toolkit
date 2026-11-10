import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const crowbar: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(136),
  label: 'Crowbar',
  description:
    "Using a crowbar grants advantage to Strength checks where the crowbar's leverage can be applied.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(2),
  weight: S.lbs(5),
  effects: [
    S.situationalCheckEffect(S.equipId(136), {
      id: S.equipmentChildId(S.equipId(136), 0x215, 1),
      grantKind: S.GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: S.VALUE_DOMAIN_CODE.ABILITY_CHECK,
      domain: { ability: S.ABILITY_CODE.STRENGTH },
      modifierKind: S.MODIFIER_KIND.ROLL_INFLUENCE,
      payload: { influence: 'ADVANTAGE' },
      scope: S.MODIFIER_SCOPE_KIND.GLOBAL,
      selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
      order: 1
    })
  ],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
