import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
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
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const stormOfVengeance: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.STORM_OF_VENGEANCE,
  label: 'Storm of Vengeance',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    'You call down a vast storm centered on a point you can see, and each round of maintained concentration unleashes escalating effects of thunder, acid, lightning, hail, and brutal winds.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 9,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('CONJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.STORM_OF_VENGEANCE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.STORM_OF_VENGEANCE, 0x211, 1),
          rangeKind: RANGE_KIND.SIGHT
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.STORM_OF_VENGEANCE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.STORM_OF_VENGEANCE, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.STORM_OF_VENGEANCE, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.STORM_OF_VENGEANCE, 0x212, 1),
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
