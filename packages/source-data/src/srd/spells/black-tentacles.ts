import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  conditionTypeId,
  damageTypeId,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'
export const blackTentacles: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.BLACK_TENTACLES,
  label: 'Black Tentacles',
  description:
    '<p>Squirming, ebony tentacles fill a 20-foot square on ground that you can see within range. For the duration, these tentacles turn the ground in the area into difficult terrain. When a creature enters the affected area for the first time on a turn or starts its turn there, the creature must succeed on a Dexterity saving throw or take 3d6 bludgeoning damage and be restrained by the tentacles until the spell ends. A creature that starts its turn in the area and is already restrained by the tentacles takes 3d6 bludgeoning damage. A creature restrained by the tentacles can use its action to make a Strength or Dexterity check (its choice) against your spell save DC. On a success, it frees itself.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a piece of tentacle from a giant octopus or a giant squid',
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 90,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x212, 1),
          shapeKind: SHAPE_KIND.CUBE,
          edgeLength: {
            amount: 20,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x214, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x213, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                attachmentKind: 'PLACED_SPACE',
                label: 'Black Tentacles',
                shape: {
                  id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x220, 1),
                  shapeKind: SHAPE_KIND.CUBE,
                  edgeLength: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
                },
                components: [
                  {
                    id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x221, 1),
                    order: 1,
                    label: 'Enter the tentacles',
                    interactionKinds: [
                      'ENTER_OR_PASS_THROUGH' as const,
                      'START_TURN_IN_SPACE' as const
                    ],
                    maxApplicationsPerTurn: 1,
                    behaviors: [
                      {
                        id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x222, 1),
                        order: 1,
                        invocation: {
                          kind: 'PASSIVE' as const,
                          triggerCode: TRIGGER.SAVING_THROW,
                          savingThrow: {
                            id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x223, 1),
                            dcMethod: 'SOURCE_SAVE_DC' as const,
                            abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
                          },
                          range: {
                            id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x224, 1),
                            rangeKind: RANGE_KIND.SELF
                          }
                        },
                        paths: [
                          {
                            id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x225, 1),
                            order: 1,
                            pathCode: PATH_CODE.ON_SAVE_FAIL,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x225, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              lifecycle: {
                                heldBySource: true,
                                escape: {
                                  activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                                  checks: {
                                    skillIds: [],
                                    abilityDefinitionIds: [
                                      SRD_ABILITY_DEFINITION_IDS.STRENGTH,
                                      SRD_ABILITY_DEFINITION_IDS.DEXTERITY
                                    ]
                                  },
                                  dc: { kind: 'SOURCE_SAVE_DC' as const }
                                }
                              },
                              outcomes: [
                                {
                                  id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x226, 1),
                                  effectKind: EFFECT_KIND.DAMAGE,
                                  damageTypeId: damageTypeId('BLUDGEONING'),
                                  valueKind: DAMAGE_VALUE_KIND.DICE,
                                  scalingKind: SCALING.NONE,
                                  diceConfig: '3d6'
                                },
                                {
                                  id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x227, 1),
                                  effectKind: EFFECT_KIND.CONDITION,
                                  conditionId: conditionTypeId('RESTRAINED')
                                },
                                {
                                  id: spellChildId(SPELL_IDS.BLACK_TENTACLES, 0x228, 1),
                                  effectKind: EFFECT_KIND.MOVEMENT_RULE,
                                  ruleKind: 'STOP_CURRENT_MOVEMENT' as const
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
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
