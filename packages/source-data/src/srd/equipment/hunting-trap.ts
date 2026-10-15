import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const huntingTrap: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(143),
  label: 'Hunting Trap',
  description:
    'When you use your action to set it, this trap forms a saw-toothed steel ring that snaps shut when a creature steps on a pressure plate in the center. The trap is affixed by a heavy chain to an immobile object, such as a tree or a spike driven into the ground. A creature that steps on the plate must succeed on a DC 13 Dexterity saving throw or take 1d4 piercing damage and stop moving. Thereafter, until the creature breaks free of the trap, its movement is limited by the length of the chain (typically 3 feet long). A creature can use its action to make a DC 13 Strength check, freeing itself or another creature within its reach on a success. Each failed check deals 1 piercing damage to the trapped creature.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  effects: [
    {
      id: S.equipmentChildId(S.equipId(143), 0x210, 1),
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
          id: S.equipmentChildId(S.equipId(143), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(143), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_USE,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(143), 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(143), 0x212, 1),
                effectKind: S.EFFECT_KIND.MANIFEST,
                manifestKind: 'OBJECT' as const,
                attachmentKind: 'PLACED_SPACE' as const,
                label: 'Set hunting trap',
                components: [
                  {
                    id: S.equipmentChildId(S.equipId(143), 0x220, 1),
                    order: 1,
                    label: 'Pressure plate',
                    interactionKind: 'ENTER_OR_PASS_THROUGH' as const,
                    behaviors: [
                      {
                        id: S.equipmentChildId(S.equipId(143), 0x221, 1),
                        order: 1,
                        invocation: {
                          kind: 'PASSIVE' as const,
                          triggerCode: S.TRIGGER.SAVING_THROW,
                          savingThrow: {
                            id: S.equipmentChildId(S.equipId(143), 0x222, 1),
                            dcMethod: 'FIXED_DC' as const,
                            abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
                            baseDc: 13
                          },
                          range: {
                            id: S.equipmentChildId(S.equipId(143), 0x223, 1),
                            rangeKind: S.RANGE_KIND.SELF
                          }
                        },
                        paths: [
                          {
                            id: S.equipmentChildId(S.equipId(143), 0x224, 1),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${S.equipmentChildId(S.equipId(143), 0x224, 1)}__result`,
                              resultKind: 'SEQUENCE' as const,
                              outcomes: [
                                {
                                  id: S.equipmentChildId(S.equipId(143), 0x225, 1),
                                  effectKind: S.EFFECT_KIND.DAMAGE,
                                  damageTypeId: S.damageTypeId('PIERCING'),
                                  valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                  scalingKind: S.SCALING.NONE,
                                  diceConfig: '1d4'
                                },
                                {
                                  id: S.equipmentChildId(S.equipId(143), 0x226, 1),
                                  effectKind: S.EFFECT_KIND.MOVEMENT_RULE,
                                  ruleKind: 'STOP_CURRENT_MOVEMENT' as const
                                },
                                {
                                  id: S.equipmentChildId(S.equipId(143), 0x227, 1),
                                  effectKind: S.EFFECT_KIND.MOVEMENT_RULE,
                                  ruleKind: 'LIMIT_DISTANCE_FROM_ANCHOR' as const,
                                  limitDistance: {
                                    amount: 3,
                                    unit: S.MEASUREMENT_UNIT_CODE.FEET
                                  }
                                },
                                {
                                  id: S.equipmentChildId(S.equipId(143), 0x228, 1),
                                  effectKind: S.EFFECT_KIND.FOLLOW_UP_CHECK,
                                  label: 'Break free of the hunting trap',
                                  activation: {
                                    code: S.ACTIVATION_CODE.ACTION,
                                    amount: 1
                                  },
                                  ability: S.ABILITY_CODE.STRENGTH,
                                  fixedDc: 13,
                                  actorKinds: ['TARGET', 'CREATURE_WITHIN_REACH'],
                                  repeatable: true,
                                  onSuccess: { kind: 'END' as const },
                                  onFailure: {
                                    kind: 'OUTCOMES' as const,
                                    endCurrent: false,
                                    resultKind: 'SINGLE' as const,
                                    outcomes: [
                                      {
                                        id: S.equipmentChildId(S.equipId(143), 0x229, 1),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.FIXED,
                                        scalingKind: S.SCALING.NONE,
                                        amount: 1
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
  cost: S.gp(5),
  weight: S.lbs(25),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
