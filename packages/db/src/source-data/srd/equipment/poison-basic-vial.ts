import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const poisonBasicVial: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(364),
  label: 'Poison, Basic (vial)',
  description: 'You can use the poison in this vial to coat one slashing or piercing weapon or up to three pieces of ammunition. Applying the poison takes an action. A creature hit by the poisoned weapon or ammunition must make a DC 10 Constitution saving throw or take 1d4 poison damage. Once applied, the poison retains potency for 1 minute before drying.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.VIAL, S.EQUIPMENT_PROPERTY_CODE.POISON],
  effects: [
    {
      id: S.equipmentChildId(S.equipId(364), 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(364), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(364), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_USE,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(364), 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(364), 0x212, 1),
                effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
              }
            ]
          }
        }
      ]
    }
  ],
  cost: S.gp(100),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
