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

export const commune: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.COMMUNE,
  label: 'Commune',
  description:
    'You contact your deity or a divine proxy and ask up to three questions that can be answered with a yes or no. You must ask your questions before the spell ends.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.CLERIC],
  magicSchoolId: schoolId('DIVINATION'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.COMMUNE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.COMMUNE, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: 'SELF',
          detail: 'You contact your deity or a divine proxy and ask up to three questions.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.COMMUNE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Commune Reply',
          description: 'Receive answers of yes, no, unclear, or no reply to up to three questions before the spell ends.'
        }
      ]
    }
  ],
  materialDescription: 'incense and a vial of holy or unholy water',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
}
