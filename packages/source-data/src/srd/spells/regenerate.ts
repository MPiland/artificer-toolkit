import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SCALING,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const regenerate: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.REGENERATE,
  label: 'Regenerate',
  description:
    "<p>You touch a creature and stimulate its natural healing ability. The target regains 4d8 + 15 hit points. For the duration of the spell, the target regains 1 hit point at the start of each of its turns (10 hit points each minute). The target's severed body members (fingers, legs, tails, and so on), if any, are restored after 2 minutes. If you have the severed part and hold it to the stump, the spell instantaneously causes the limb to knit to the stump.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a prayer wheel and holy water',
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [],
  effects: [
    {
      id: spellChildId(SPELL_IDS.REGENERATE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.REGENERATE, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.REGENERATE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.REGENERATE, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.REGENERATE, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.REGENERATE, 0x212, 1),
                effectKind: EFFECT_KIND.HEAL,
                scalingKind: SCALING.NONE,
                valueKind: 'DICE' as const,
                diceConfig: '4d8+15'
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.REGENERATE, 0x215, 1),
          order: 2,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.REGENERATE, 0x215, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.REGENERATE, 0x216, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            lifecycle: {
              recurringKind: 'START_OF_TURN' as const
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.REGENERATE, 0x215, 1),
                effectKind: EFFECT_KIND.HEAL,
                scalingKind: SCALING.NONE,
                valueKind: 'FIXED' as const,
                amount: 1
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
