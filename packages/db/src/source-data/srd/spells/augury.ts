import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const augury: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.AUGURY,
  label: 'Augury',
  description:
    'By casting this spell, you can ask a deity or diviner advice about a specific course of action you plan to take within the next 30 minutes. The DM chooses from the possible outcomes: weal, woe, weal and woe, or nothing.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
  magicSchoolId: schoolId('DIVINATION'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.AUGURY, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.AUGURY, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: 'SELF',
          detail: 'Perform the divination yourself.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.AUGURY, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Augury',
          description:
            'You ask for advice about a specific course of action and receive a limited prophetic answer: weal, woe, both, or nothing.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
