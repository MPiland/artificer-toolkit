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
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const fear: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FEAR,
  label: 'Fear',
  description:
    "<p>You project a phantasmal image of a creature's worst fears. Each creature in a 30-foot cone must succeed on a Wisdom saving throw or drop whatever it is holding and become frightened for the duration. While frightened by this spell, a creature must take the Dash action and move away from you by the safest available route on each of its turns, unless there is nowhere to move. If the creature ends its turn in a location where it doesn't have line of sight to you, the creature can make a Wisdom saving throw. On a successful save, the spell ends for that creature.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a white feather or the heart of a hen',
  magicSchoolId: schoolId('ILLUSION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.FEAR, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.FEAR, 0x213, 2),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FEAR, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        shape: {
          id: spellChildId(SPELL_IDS.FEAR, 0x212, 1),
          shapeKind: SHAPE_KIND.CONE,
          length: {
            amount: 30,
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
          id: spellChildId(SPELL_IDS.FEAR, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.FEAR, 0x217, 1),
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.FEAR, 0x214, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.FEAR, 0x213, 1),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('FRIGHTENED'),
                recordsSource: true,
                fleesSource: true
              },
              {
                id: spellChildId(SPELL_IDS.FEAR, 0x215, 1),
                effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                timing: 'TARGET_TURN_END' as const,
                savingThrow: {
                  id: spellChildId(SPELL_IDS.FEAR, 0x216, 1),
                  dcMethod: 'SOURCE_SAVE_DC' as const,
                  abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
                },
                attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                onSuccess: { kind: 'END' as const },
                onFailure: { kind: 'CONTINUE' as const },
                // The save is made only at the end of a turn the Frightened creature can't see the caster.
                repeatAttemptGate: {
                  allow: 'WHEN_UNMET' as const,
                  when: {
                    kind: 'PERCEPTION' as const,
                    observer: 'TARGET' as const,
                    subject: 'SOURCE' as const,
                    requirement: 'SEE' as const
                  }
                }
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
