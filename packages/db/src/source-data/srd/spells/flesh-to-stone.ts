import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const fleshToStone: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FLESH_TO_STONE,
  label: 'Flesh to Stone',
  description:
    "<p>You attempt to turn one creature that you can see within range into stone. If the target's body is made of flesh, the creature must make a Constitution saving throw. On a failed save, it is restrained as its flesh begins to harden. On a successful save, the creature isn't affected. A creature restrained by this spell must make another Constitution saving throw at the end of each of its turns. If it successfully saves against this spell three times, the spell ends. If it fails its saves three times, it is turned to stone and subjected to the petrified condition for the duration. The successes and failures don't need to be consecutive; keep track of both until the target collects three of a kind. If the creature is physically broken while petrified, it suffers from similar deformities if it reverts to its original state. If you maintain your concentration on this spell for the entire possible duration, the creature is turned to stone until the effect is removed.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a pinch of lime, water, and earth',
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x211, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x212, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x213, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x214, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x213, 1),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('RESTRAINED')
              },
              {
                id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x216, 1),
                effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                timing: 'TARGET_TURN_END' as const,
                savingThrow: {
                  id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x217, 1),
                  dcMethod: 'SOURCE_SAVE_DC' as const,
                  abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION
                },
                attempts: {
                  kind: 'THRESHOLDS' as const,
                  successesToEnd: 3,
                  failuresToResolve: 3,
                  consecutive: false
                },
                onSuccess: { kind: 'END' as const },
                onFailure: {
                  kind: 'OUTCOMES' as const,
                  endCurrent: false,
                  resultKind: 'SINGLE' as const,
                  outcomes: [
                    {
                      id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x218, 1),
                      effectKind: EFFECT_KIND.CONDITION,
                      conditionId: conditionTypeId('PETRIFIED')
                    }
                  ]
                },
                onDurationComplete: {
                  kind: 'OUTCOMES' as const,
                  endCurrent: true,
                  resultKind: 'SINGLE' as const,
                  outcomes: [
                    {
                      id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x219, 1),
                      effectKind: EFFECT_KIND.CONDITION,
                      conditionId: conditionTypeId('PETRIFIED')
                    }
                  ]
                }
              },
              {
                id: spellChildId(SPELL_IDS.FLESH_TO_STONE, 0x21a, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Resolve petrified deformities',
                reasonCode: 'NARRATIVE_JUDGMENT' as const,
                instructions:
                  'If the creature is physically broken while petrified, it suffers from similar deformities if it reverts to its original state.'
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
