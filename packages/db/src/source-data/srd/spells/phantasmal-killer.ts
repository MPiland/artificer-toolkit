import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import {
  conditionTypeId,
  damageTypeId,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'
export const phantasmalKiller: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PHANTASMAL_KILLER,
  label: 'Phantasmal Killer',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    "<p>You tap into the nightmares of a creature you can see within range and create an illusory manifestation of its deepest fears, visible only to that creature. The target must make a Wisdom saving throw. On a failed save, the target becomes frightened for the duration. At the end of each of the target's turns before the spell ends, the target must succeed on a Wisdom saving throw or take 4d10 psychic damage. On a successful save, the spell ends. At Higher Levels. When you cast this spell using a spell slot of 5th level or higher, the damage increases by 1d10 for each slot level above 4th.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('ILLUSION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x211, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.WISDOM
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x212, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x213, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x214, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x213, 1),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('FRIGHTENED')
              },
              {
                id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x216, 1),
                effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                timing: 'TARGET_TURN_END' as const,
                savingThrow: {
                  id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x217, 1),
                  dcMethod: 'SOURCE_SAVE_DC' as const,
                  ability: ABILITY_CODE.WISDOM
                },
                attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                onSuccess: { kind: 'END' as const },
                onFailure: {
                  kind: 'OUTCOMES' as const,
                  endCurrent: false,
                  resultKind: 'SINGLE' as const,
                  outcomes: [
                    {
                      id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x218, 1),
                      effectKind: EFFECT_KIND.DAMAGE,
                      damageTypeId: damageTypeId('PSYCHIC'),
                      valueKind: DAMAGE_VALUE_KIND.DICE,
                      scalingKind: SCALING.PER_LEVEL,
                      scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                      levels: Array.from({ length: 6 }, (_, index) => ({
                        id: spellChildId(SPELL_IDS.PHANTASMAL_KILLER, 0x219, index + 1),
                        level: index + 4,
                        order: index + 1,
                        diceConfig: `${index + 4}d10`
                      }))
                    }
                  ]
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
