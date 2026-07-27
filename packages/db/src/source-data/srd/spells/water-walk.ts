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
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const waterWalk: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.WATER_WALK,
  label: 'Water Walk',
  description:
    'This spell grants the ability to move across any liquid surface as if it were harmless solid ground to up to ten willing creatures you can see within range for the duration.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.RANGER, CLASS_IDS.SORCERER],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a piece of cork',
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  effects: [
    {
      id: spellChildId(SPELL_IDS.WATER_WALK, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.WATER_WALK, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING,
          maxTargets: 10
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.WATER_WALK, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.WATER_WALK, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.WATER_WALK, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.WATER_WALK, 0x212, 1),
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
