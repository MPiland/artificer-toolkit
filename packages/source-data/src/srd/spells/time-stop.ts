import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
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
export const timeStop: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.TIME_STOP,
  label: 'Time Stop',
  description:
    '<p>You briefly stop the flow of time for everyone but yourself. No time passes for other creatures, while you take 1d4 + 1 turns in a row, during which you can use actions and move as normal. This spell ends if one of the actions you use during this period, or any effects that you create during this period, affects a creature other than you or an object being worn or carried by someone other than you. In addition, the spell ends if you move to a place more than 1,000 feet from the location where you cast it.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 9,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('TRANSMUTATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.TIME_STOP, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.TIME_STOP, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.TIME_STOP, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.TIME_STOP, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.TIME_STOP, 0x212, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Take Extra Turns',
                reasonCode: 'GM_CHOICE' as const,
                instructions:
                  'You take 1d4 + 1 turns in a row while no time passes for other creatures. The spell ends if one of your actions or effects during this period affects a creature other than you or an object worn or carried by someone else, or if you move more than 1,000 feet from where you cast it.'
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
