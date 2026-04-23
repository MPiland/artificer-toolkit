import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const prayerBook: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(165),
    label: 'Prayer Book',
    description: "A devotional text containing prayers, hymns, and religious teachings.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.gp(25),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
