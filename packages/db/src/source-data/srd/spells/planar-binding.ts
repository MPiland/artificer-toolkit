import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const planarBinding: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PLANAR_BINDING,
  label: 'Planar Binding',
  description:
    'With this spell, you attempt to bind a celestial, an elemental, a fey, or a fiend to your service. The creature must be within range for the entire casting of the spell.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a jewel worth at least 1,000 gp, which the spell consumes',
  magicSchoolId: schoolId('ABJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x211, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.CHARISMA
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x212, 1),
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
          id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x214, 1),
              durationKind: DURATION_KIND.DAY,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x213, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x215, 1),
          order: 2,
          pathCode: PATH_CODE.ON_SAVE_SUCCESS,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x215, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.PLANAR_BINDING, 0x215, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION
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
