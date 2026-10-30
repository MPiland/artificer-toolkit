import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const caltropsBagOf20: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(128),
  label: 'Caltrops (bag of 20)',
  description:
    "As an action, you can spread a bag of caltrops to cover a square area that is 5 feet on a side. Any creature that enters the area must succeed on a DC 15 Dexterity saving throw or stop moving this turn and take 1 piercing damage. Taking this damage reduces the creature's walking speed by 10 feet until the creature regains at least 1 hit point. A creature moving through the area at half speed doesn't need to make the save.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  effects: [
    {
      id: S.equipmentChildId(S.equipId(128), 0x210, 1),
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
          id: S.equipmentChildId(S.equipId(128), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(128), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_USE,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(128), 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(128), 0x212, 1),
                effectKind: S.EFFECT_KIND.MANIFEST,
                manifestKind: 'ZONE' as const,
                attachmentKind: 'PLACED_SPACE' as const,
                label: 'Caltrop field',
                shape: {
                  id: S.equipmentChildId(S.equipId(128), 0x220, 1),
                  shapeKind: S.SHAPE_KIND.CUBE,
                  edgeLength: { amount: 5, unit: S.MEASUREMENT_UNIT_CODE.FEET }
                },
                components: [
                  {
                    id: S.equipmentChildId(S.equipId(128), 0x221, 1),
                    order: 1,
                    label: 'Enter the caltrop field',
                    interactionKinds: ['ENTER_OR_PASS_THROUGH' as const],
                    bypassAtHalfSpeed: true,
                    behaviors: [
                      {
                        id: S.equipmentChildId(S.equipId(128), 0x222, 1),
                        order: 1,
                        invocation: {
                          kind: 'PASSIVE' as const,
                          triggerCode: S.TRIGGER.SAVING_THROW,
                          savingThrow: {
                            id: S.equipmentChildId(S.equipId(128), 0x223, 1),
                            dcMethod: 'FIXED_DC' as const,
                            abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
                            baseDc: 15
                          },
                          range: {
                            id: S.equipmentChildId(S.equipId(128), 0x224, 1),
                            rangeKind: S.RANGE_KIND.SELF
                          }
                        },
                        paths: [
                          {
                            id: S.equipmentChildId(S.equipId(128), 0x225, 1),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${S.equipmentChildId(S.equipId(128), 0x225, 1)}__result`,
                              resultKind: 'SEQUENCE' as const,
                              lifecycle: {
                                endTriggers: [
                                  {
                                    event: 'LIFECYCLE' as const,
                                    timing: 'END' as const,
                                    code: 'ON_HIT_POINTS_REGAINED'
                                  }
                                ]
                              },
                              outcomes: [
                                {
                                  id: S.equipmentChildId(S.equipId(128), 0x226, 1),
                                  effectKind: S.EFFECT_KIND.MOVEMENT_RULE,
                                  ruleKind: 'STOP_CURRENT_MOVEMENT' as const
                                },
                                {
                                  id: S.equipmentChildId(S.equipId(128), 0x227, 1),
                                  effectKind: S.EFFECT_KIND.DAMAGE,
                                  damageTypeId: S.damageTypeId('PIERCING'),
                                  valueKind: S.DAMAGE_VALUE_KIND.FIXED,
                                  scalingKind: S.SCALING.NONE,
                                  amount: 1
                                },
                                {
                                  id: S.equipmentChildId(S.equipId(128), 0x228, 1),
                                  effectKind: S.EFFECT_KIND.APPLY_GRANT,
                                  grants: {
                                    modifiers: [
                                      {
                                        id: S.equipmentChildId(S.equipId(128), 0x229, 1),
                                        grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                                        valueDomainCode: S.VALUE_DOMAIN_CODE.SPEED,
                                        domain: { speedId: S.speedId('WALK') },
                                        modifierKind: S.MODIFIER_KIND.PENALTY,
                                        scope: S.MODIFIER_SCOPE_KIND.GLOBAL,
                                        selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                                        payload: { amount: 10, unit: 'FEET' as const },
                                        order: 1
                                      }
                                    ]
                                  }
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
