import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const ballBearingsBagOf1000: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(122),
  label: 'Ball Bearings (bag of 1000)',
  description:
    "As an action, you can spill these tiny metal balls from their pouch to cover a level, square area that is 10 feet on a side. A creature moving across the covered area must succeed on a DC 10 Dexterity saving throw or fall prone. A creature moving through the area at half speed doesn't need to make the save.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  effects: [
    {
      id: S.equipmentChildId(S.equipId(122), 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(122), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(122), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_USE,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(122), 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(122), 0x212, 1),
                effectKind: S.EFFECT_KIND.MANIFEST,
                manifestKind: 'ZONE' as const,
                attachmentKind: 'PLACED_SPACE' as const,
                label: 'Ball-bearing field',
                shape: {
                  id: S.equipmentChildId(S.equipId(122), 0x220, 1),
                  shapeKind: S.SHAPE_KIND.CUBE,
                  edgeLength: { amount: 10, unit: S.MEASUREMENT_UNIT_CODE.FEET }
                },
                components: [
                  {
                    id: S.equipmentChildId(S.equipId(122), 0x221, 1),
                    order: 1,
                    label: 'Move across the ball bearings',
                    interactionKind: 'MOVE_ACROSS' as const,
                    bypassAtHalfSpeed: true,
                    behaviors: [
                      {
                        id: S.equipmentChildId(S.equipId(122), 0x222, 1),
                        order: 1,
                        invocation: {
                          kind: 'PASSIVE' as const,
                          triggerCode: S.TRIGGER.SAVING_THROW,
                          savingThrow: {
                            id: S.equipmentChildId(S.equipId(122), 0x223, 1),
                            dcMethod: 'FIXED_DC' as const,
                            abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
                            baseDc: 10
                          },
                          range: {
                            id: S.equipmentChildId(S.equipId(122), 0x224, 1),
                            rangeKind: S.RANGE_KIND.SELF
                          }
                        },
                        paths: [
                          {
                            id: S.equipmentChildId(S.equipId(122), 0x225, 1),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${S.equipmentChildId(S.equipId(122), 0x225, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              outcomes: [
                                {
                                  id: S.equipmentChildId(S.equipId(122), 0x226, 1),
                                  effectKind: S.EFFECT_KIND.CONDITION,
                                  conditionId: S.conditionTypeId('PRONE')
                                }
                              ]
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  ],
  cost: S.gp(1),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
