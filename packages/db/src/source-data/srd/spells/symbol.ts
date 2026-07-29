import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const symbol: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SYMBOL,
  label: 'Symbol',
  description:
    "You inscribe a harmful magical glyph on a surface or within an object, setting conditions and a trigger for one of the spell's devastating effects.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription:
    'mercury, phosphorus, and powdered diamond and opal with a total value of at least 1,000 gp, which the spell consumes',
  magicSchoolId: schoolId('ABJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SYMBOL, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SYMBOL, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SYMBOL, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SYMBOL, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SYMBOL, 0x213, 1),
              durationKind: DURATION_KIND.UNTIL_DISPELLED
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SYMBOL, 0x212, 1),
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
