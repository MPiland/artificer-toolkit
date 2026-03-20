import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const guidance: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.GUIDANCE,
  label: 'Guidance',
  description:
    'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice. It can roll the die before or after making the ability check.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  magicSchoolId: schoolId('DIVINATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.GUIDANCE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GUIDANCE, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING,
          detail: 'Touch one willing creature.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.GUIDANCE, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.GUIDANCE, 0x213, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 1
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Guidance',
          description:
            'The target can add 1d4 to one ability check of its choice before the spell ends. This still needs a richer one-shot check bonus model to express structurally.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
