import {
  TARGET_DISPOSITION_KIND,
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const speakWithDead: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SPEAK_WITH_DEAD,
  label: 'Speak with Dead',
  description:
    'You grant the semblance of life and intelligence to a corpse of your choice within range, allowing it to answer questions you pose.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'burning incense',
  magicSchoolId: schoolId('NECROMANCY'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SPEAK_WITH_DEAD, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SPEAK_WITH_DEAD, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 10,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: 'SINGLE_TARGET',
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SPEAK_WITH_DEAD, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SPEAK_WITH_DEAD, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SPEAK_WITH_DEAD, 0x213, 1),
              durationKind: 'MINUTE',
              amount: 10
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SPEAK_WITH_DEAD, 0x212, 1),
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
