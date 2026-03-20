import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const produceFlame: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PRODUCE_FLAME,
  label: 'Produce Flame',
  description:
    'A flickering flame appears in your hand. The flame remains there for the duration and harms neither you nor your equipment. You can also attack with the flame, although doing so ends the spell.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.DRUID],
  magicSchoolId: schoolId('CONJURATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.PRODUCE_FLAME, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PRODUCE_FLAME, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF,
          detail: 'Create a flame in your hand that can later be used to make an attack.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.PRODUCE_FLAME, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Produce Flame',
          description:
            'A flickering flame appears in your hand and can be used to make a ranged spell attack, ending the spell if you attack with it.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
