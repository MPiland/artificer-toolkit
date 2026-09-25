import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const acidVial: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(119),
  label: 'Acid (vial)',
  description:
    'As an action, you can splash the contents of this vial onto a creature within 5 feet of you or throw the vial up to 20 feet, shattering it on impact. In either case, make a ranged attack against a creature or object, treating the acid as an improvised weapon. On a hit, the target takes 2d6 acid damage.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.VIAL],
  effects: [
    {
      id: S.equipmentChildId(S.equipId(119), 0x210, 1),
      order: 1,
      grip: S.EQUIPMENT_GRIP.ONE_HANDED,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(119), 0x211, 1),
          rangeKind: S.RANGE_KIND.SPECIAL
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(119), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_HIT,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(119), 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(119), 0x212, 1),
                effectKind: S.EFFECT_KIND.DAMAGE,
                damageTypeId: S.damageTypeId('ACID'),
                valueKind: S.DAMAGE_VALUE_KIND.DICE,
                scalingKind: S.SCALING.NONE,
                diceConfig: '2d6'
              }
            ]
          }
        }
      ]
    }
  ],
  cost: S.gp(25),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
