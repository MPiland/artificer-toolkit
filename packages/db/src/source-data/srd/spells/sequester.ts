import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  DURATION_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const sequester: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SEQUESTER,
  label: 'Sequester',
  description:
    'By means of this spell, a willing creature or an object can be hidden away, safe from detection for the duration. When you cast the spell and touch the target, it becomes invisible and canâ€™t be targeted by divination magic.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  range: {
    id: spellChildId(SPELL_IDS.SEQUESTER, 0x201, 1),
    rangeKind: RANGE_KIND.TOUCH
  },
  duration: {
    id: spellChildId(SPELL_IDS.SEQUESTER, 0x202, 1),
    durationKind: DURATION_KIND.UNTIL_DISPELLED
  },
  level: 7,
  classIds: [CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('TRANSMUTATION'),
  materialDescription:
    'a powder composed of diamond, emerald, ruby, and sapphire dust worth at least 5,000 gp, which the spell consumes',
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.SEQUESTER, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SEQUESTER, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Touch a willing creature or an object.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.SEQUESTER, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Sequester',
          description:
            'Hides the target from detection and divination. A creature target also enters suspended animation until the spell is dispelled.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
