import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const daylight: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.DAYLIGHT,
  label: 'Daylight',
  description:
    "Bright light spreads from a point you choose within range and fills a large sphere for the spell's duration. The light dispels darkness in the area.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [
    CLASS_IDS.CLERIC,
    CLASS_IDS.DRUID,
    CLASS_IDS.PALADIN,
    CLASS_IDS.RANGER,
    CLASS_IDS.SORCERER
  ],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.DAYLIGHT, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.DAYLIGHT, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.DAYLIGHT, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 60,
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
          id: spellChildId(SPELL_IDS.DAYLIGHT, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.DAYLIGHT, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.DAYLIGHT, 0x214, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.DAYLIGHT, 0x213, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE
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
