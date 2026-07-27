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
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}
export const hideousLaughter: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.HIDEOUS_LAUGHTER,
  label: 'Hideous Laughter',
  description:
    'A creature of your choice that you can see within range perceives everything as hilariously funny and falls into fits of laughter if this spell affects it. The target must succeed on a Wisdom saving throw or fall prone, becoming incapacitated and unable to stand up for the duration.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'tiny tarts and a feather that is waved in the air',
  magicSchoolId: schoolId('ENCHANTMENT'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.HIDEOUS_LAUGHTER, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.HIDEOUS_LAUGHTER, 0x211, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          ability: 'WISDOM'
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.HIDEOUS_LAUGHTER, 0x212, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.HIDEOUS_LAUGHTER, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.HIDEOUS_LAUGHTER, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.HIDEOUS_LAUGHTER, 0x214, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.HIDEOUS_LAUGHTER, 0x213, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.HIDEOUS_LAUGHTER, 0x215, 1),
          order: 2,
          pathCode: PATH_CODE.ON_SAVE_SUCCESS,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.HIDEOUS_LAUGHTER, 0x215, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.HIDEOUS_LAUGHTER, 0x215, 1),
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
