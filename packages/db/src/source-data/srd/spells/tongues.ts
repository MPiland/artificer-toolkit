import {
  TARGET_DISPOSITION_KIND,
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const tongues: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.TONGUES,
  label: 'Tongues',
  description:
    'This spell grants the creature you touch the ability to understand any spoken language it hears. Moreover, when the target speaks, any creature that knows at least one language and can hear the target understands what it says.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [
    CLASS_IDS.BARD,
    CLASS_IDS.CLERIC,
    CLASS_IDS.SORCERER,
    CLASS_IDS.WARLOCK,
    CLASS_IDS.WIZARD
  ],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a small clay model of a ziggurat',
  magicSchoolId: schoolId('DIVINATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.TONGUES, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.TONGUES, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: 'SINGLE_TARGET',
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.TONGUES, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.TONGUES, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.TONGUES, 0x213, 1),
              durationKind: 'HOUR',
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.TONGUES, 0x212, 1),
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
