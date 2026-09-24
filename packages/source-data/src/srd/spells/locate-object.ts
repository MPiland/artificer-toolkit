import {
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
export const locateObject: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.LOCATE_OBJECT,
  label: 'Locate Object',
  description:
    "<p>Describe or name an object that is familiar to you. You sense the direction to the object's location, as long as that object is within 1,000 feet of you. If the object is in motion, you know the direction of its movement. The spell can locate a specific object known to you, as long as you have seen it up close-within 30 feet-at least once. Alternatively, the spell can locate the nearest object of a particular kind, such as a certain kind of apparel, jewelry, furniture, tool, or weapon. This spell can't locate an object if any thickness of lead, even a thin sheet, blocks a direct path between you and the object.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [
    CLASS_IDS.BARD,
    CLASS_IDS.CLERIC,
    CLASS_IDS.DRUID,
    CLASS_IDS.PALADIN,
    CLASS_IDS.RANGER,
    CLASS_IDS.WIZARD
  ],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a forked twig',
  magicSchoolId: schoolId('DIVINATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.LOCATE_OBJECT, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.LOCATE_OBJECT, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 1000,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: 'SELF'
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.LOCATE_OBJECT, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.LOCATE_OBJECT, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.LOCATE_OBJECT, 0x213, 1),
              durationKind: 'MINUTE',
              amount: 10
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.LOCATE_OBJECT, 0x212, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Reveal the Object\u0027s Direction',
                reasonCode: 'EXTERNAL_WORLD_STATE' as const,
                instructions:
                  'The spell can locate a specific object known to you, as long as you have seen it up close-within 30 feet-at least once.'
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
