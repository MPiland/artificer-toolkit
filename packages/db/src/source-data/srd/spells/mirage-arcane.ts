import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
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
export const mirageArcane: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MIRAGE_ARCANE,
  label: 'Mirage Arcane',
  description:
    "You make terrain in an area up to 1 mile square look, sound, smell, and even feel like some other sort of terrain. The terrain's general shape remains the same, however.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
  level: 7,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('ILLUSION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.MIRAGE_ARCANE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MIRAGE_ARCANE, 0x201, 1),
          rangeKind: RANGE_KIND.SIGHT
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.MIRAGE_ARCANE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.MIRAGE_ARCANE, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.MIRAGE_ARCANE, 0x202, 1),
              durationKind: DURATION_KIND.DAY,
              amount: 10
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.MIRAGE_ARCANE, 0x212, 1),
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
