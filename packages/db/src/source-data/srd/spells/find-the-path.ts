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

export const findThePath: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FIND_THE_PATH,
  label: 'Find the Path',
  description:
    'This spell allows you to find the shortest, most direct physical route to a specific fixed location that you are familiar with on the same plane of existence.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  magicSchoolId: schoolId('DIVINATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.FIND_THE_PATH, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FIND_THE_PATH, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: 'SELF',
          detail: 'Receive guidance toward a specific fixed location that you are familiar with on the same plane.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.FIND_THE_PATH, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.FIND_THE_PATH, 0x213, 1),
            durationKind: 'DAY',
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Find the Path Guidance',
          description: 'Reveal the shortest, most direct physical route to the chosen destination for the duration.'
        }
      ]
    }
  ],
  materialDescription:
    'a set of divinatory tools, such as bones, ivory sticks, cards, teeth, or carved runes worth 100 gp and an object from the location you wish to find',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
