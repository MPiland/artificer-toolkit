import {
  TARGET_DISPOSITION_KIND,
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const web: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.WEB,
  label: 'Web',
  description:
    "<p>You conjure a mass of thick, sticky webbing at a point of your choice within range. The webs fill a 20-foot cube from that point for the duration. The webs are difficult terrain and lightly obscure their area. If the webs aren't anchored between two solid masses (such as walls or trees) or layered across a floor, wall, or ceiling, the conjured web collapses on itself, and the spell ends at the start of your next turn. Webs layered over a flat surface have a depth of 5 feet. Each creature that starts its turn in the webs or that enters them during its turn must make a Dexterity saving throw. On a failed save, the creature is restrained as long as it remains in the webs or until it breaks free. A creature restrained by the webs can use its action to make a Strength check against your spell save DC. If it succeeds, it is no longer restrained. The webs are flammable. Any 5-foot cube of webs exposed to fire burns away in 1 round, dealing 2d4 fire damage to any creature that starts its turn in the fire.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a bit of spiderweb',
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.WEB, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.WEB, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.WEB, 0x212, 1),
          shapeKind: SHAPE_KIND.CUBE,
          edgeLength: {
            amount: 20,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        },
        targeting: {
          selectionKind: 'AREA_CONTENTS',
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.WEB, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.WEB, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.WEB, 0x214, 1),
              durationKind: 'HOUR',
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.WEB, 0x213, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                attachmentKind: 'PLACED_SPACE',
                label: 'Web',
                shape: {
                  id: spellChildId(SPELL_IDS.WEB, 0x220, 1),
                  shapeKind: SHAPE_KIND.CUBE,
                  edgeLength: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
                },
                components: [
                  {
                    id: spellChildId(SPELL_IDS.WEB, 0x221, 1),
                    order: 1,
                    label: 'Enter the webs',
                    interactionKinds: [
                      'ENTER_OR_PASS_THROUGH' as const,
                      'START_TURN_IN_SPACE' as const
                    ],
                    // The area is difficult terrain.
                    movementCostMultiplier: 2,
                    behaviors: [
                      {
                        id: spellChildId(SPELL_IDS.WEB, 0x222, 1),
                        order: 1,
                        invocation: {
                          kind: 'PASSIVE' as const,
                          triggerCode: TRIGGER.SAVING_THROW,
                          savingThrow: {
                            id: spellChildId(SPELL_IDS.WEB, 0x223, 1),
                            dcMethod: 'SOURCE_SAVE_DC' as const,
                            abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
                          },
                          range: {
                            id: spellChildId(SPELL_IDS.WEB, 0x224, 1),
                            rangeKind: RANGE_KIND.SELF
                          }
                        },
                        paths: [
                          {
                            id: spellChildId(SPELL_IDS.WEB, 0x225, 1),
                            order: 1,
                            pathCode: PATH_CODE.ON_SAVE_FAIL,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.WEB, 0x225, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              lifecycle: {
                                heldBySource: true,
                                endTriggers: [
                                  {
                                    event: 'LIFECYCLE' as const,
                                    timing: 'END' as const,
                                    code: 'ON_LEAVING_AREA'
                                  }
                                ],
                                escape: {
                                  activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                                  checks: {
                                    skillIds: [],
                                    abilityDefinitionIds: [SRD_ABILITY_DEFINITION_IDS.STRENGTH]
                                  },
                                  dc: { kind: 'SOURCE_SAVE_DC' as const }
                                }
                              },
                              outcomes: [
                                {
                                  id: spellChildId(SPELL_IDS.WEB, 0x226, 1),
                                  effectKind: EFFECT_KIND.CONDITION,
                                  conditionId: conditionTypeId('RESTRAINED')
                                },
                                {
                                  id: spellChildId(SPELL_IDS.WEB, 0x227, 1),
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
