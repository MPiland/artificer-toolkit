import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const legendLore: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.LEGEND_LORE,
  label: 'Legend Lore',
  description:
    'Name or describe a person, place, or object. The spell brings to your mind a brief summary of the significant lore about the thing you named.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
  level: 5,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('DIVINATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.LEGEND_LORE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.LEGEND_LORE, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: 'SELF',
          detail: 'Name or describe a person, place, or object to learn significant lore about it.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.LEGEND_LORE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Legend Lore Insight',
          description: 'Receive a brief summary of the significant lore about the named or described person, place, or object.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
