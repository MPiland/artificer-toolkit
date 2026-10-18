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
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
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
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
/** The swarm's piercing damage: 4d10 cast at the 5th level, and 1d10 more for each slot level above it. */
const zoneDamage = (kind: number) => ({
  id: spellChildId(SPELL_IDS.INSECT_PLAGUE, kind, 1),
  effectKind: EFFECT_KIND.DAMAGE,
  damageTypeId: damageTypeId('PIERCING'),
  valueKind: DAMAGE_VALUE_KIND.DICE,
  scalingKind: SCALING.PER_LEVEL,
  scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
  levels: Array.from({ length: 5 }, (_, index) => ({
    id: spellChildId(SPELL_IDS.INSECT_PLAGUE, kind, index + 2),
    level: index + 5,
    order: index + 1,
    diceConfig: `${index + 4}d10`
  }))
})
export const insectPlague: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.INSECT_PLAGUE,
  label: 'Insect Plague',
  description:
    "<p>Swarming, biting locusts fill a 20-foot-radius sphere centered on a point you choose within range. The sphere spreads around corners. The sphere remains for the duration, and its area is lightly obscured. The sphere's area is difficult terrain. When the area appears, each creature in it must make a Constitution saving throw. A creature takes 4d10 piercing damage on a failed save, or half as much damage on a successful one. A creature must also make this saving throw when it enters the spell's area for the first time on a turn or ends its turn there. At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, the damage increases by 1d10 for each slot level above 5th.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.SORCERER],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a few grains of sugar, some kernels of grain, and a smear of fat',
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        // The save each creature in the area makes when it appears; the swarm's own is on entry.
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x230, 1),
          dcMethod: 'SOURCE_SAVE_DC' as const,
          abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 300,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: {
          id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 20,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x214, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 10
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x213, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                attachmentKind: 'PLACED_SPACE',
                label: 'Insect Plague',
                shape: {
                  id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x220, 1),
                  shapeKind: SHAPE_KIND.SPHERE,
                  radius: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
                },
                components: [
                  {
                    id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x221, 1),
                    order: 1,
                    label: 'Enter the locust swarm',
                    interactionKinds: [
                      'ENTER_OR_PASS_THROUGH' as const,
                      'END_TURN_IN_SPACE' as const
                    ],
                    maxApplicationsPerTurn: 1,
                    behaviors: [
                      {
                        id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x222, 1),
                        order: 1,
                        invocation: {
                          kind: 'PASSIVE' as const,
                          triggerCode: TRIGGER.SAVING_THROW,
                          savingThrow: {
                            id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x223, 1),
                            dcMethod: 'SOURCE_SAVE_DC' as const,
                            abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION
                          },
                          range: {
                            id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x224, 1),
                            rangeKind: RANGE_KIND.SELF
                          }
                        },
                        paths: [
                          {
                            id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x225, 1),
                            order: 1,
                            pathCode: PATH_CODE.ON_SAVE_FAIL,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x225, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              outcomes: [zoneDamage(0x226)]
                            }
                          },
                          {
                            id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x227, 1),
                            order: 2,
                            pathCode: PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x227, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              outcomes: [
                                { ...zoneDamage(0x228), amountKind: SCALING_AMOUNT_KIND.HALF }
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
        },
        {
          id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x231, 1),
          order: 2,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: `${spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x231, 1)}__result`,
            resultKind: 'SINGLE' as const,
            outcomes: [zoneDamage(0x232)]
          }
        },
        {
          id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x233, 1),
          order: 3,
          pathCode: PATH_CODE.ON_SAVE_SUCCESS,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: `${spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x233, 1)}__result`,
            resultKind: 'SINGLE' as const,
            outcomes: [{ ...zoneDamage(0x234), amountKind: SCALING_AMOUNT_KIND.HALF }]
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
