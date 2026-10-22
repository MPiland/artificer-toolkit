import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const antitoxinVial: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(121),
  label: 'Antitoxin (vial)',
  description:
    'A creature that drinks this vial of liquid gains advantage on saving throws against poison for 1 hour. It confers no benefit to undead or constructs.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.VIAL, S.EQUIPMENT_PROPERTY_CODE.DRINK],
  attributes: [S.EQUIPMENT_ATTRIBUTE.CONSUMED_ON_USE],
  effects: [
    {
      id: S.equipmentChildId(S.equipId(121), 0x210, 1),
      order: 1,
      grip: null,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(121), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY,
          excludedCreatureTypeIds: [S.creatureTypeId('UNDEAD'), S.creatureTypeId('CONSTRUCT')]
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(121), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_USE,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(121), 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: S.equipmentChildId(S.equipId(121), 0x213, 1),
              durationKind: S.DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(121), 0x212, 1),
                effectKind: S.EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: Object.values(S.ABILITY_CODE).map((ability, index) => ({
                    id: S.equipmentChildId(S.equipId(121), 0x214, index + 1),
                    grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                    valueDomainCode: S.VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                    domain: {
                      ability,
                      conditionTypeId: S.conditionTypeId('POISONED')
                    },
                    modifierKind: S.MODIFIER_KIND.ROLL_INFLUENCE,
                    payload: { influence: 'ADVANTAGE' },
                    scope: S.MODIFIER_SCOPE_KIND.GLOBAL,
                    selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                    order: index + 1
                  }))
                }
              }
            ]
          }
        }
      ]
    }
  ],
  cost: S.gp(50),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
