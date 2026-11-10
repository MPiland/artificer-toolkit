import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const portableRam: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(163),
  label: 'Portable Ram',
  description:
    'You can use a portable ram to break down doors. When doing so, you gain a +4 bonus on the Strength check. One other character can help you use the ram, giving you advantage on this check.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(4),
  weight: S.lbs(35),
  // The helper's advantage is the Help action.
  effects: [
    S.situationalCheckEffect(S.equipId(163), {
      id: S.equipmentChildId(S.equipId(163), 0x215, 1),
      grantKind: S.GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: S.VALUE_DOMAIN_CODE.ABILITY_CHECK,
      domain: { ability: S.ABILITY_CODE.STRENGTH },
      modifierKind: S.MODIFIER_KIND.BONUS,
      payload: { valueKind: 'FIXED', amount: 4 },
      scope: S.MODIFIER_SCOPE_KIND.GLOBAL,
      selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
      order: 1
    })
  ],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
